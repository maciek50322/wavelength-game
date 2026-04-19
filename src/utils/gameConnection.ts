import Peer, { DataConnection } from "peerjs";
import { preparePeerConnection } from "./peerConnection";
import {
  createHostDataHandler,
  createPlayerDataHandler,
  HostData,
  hostId,
  HostInterface,
  PlayerInterface,
} from "./gameState";
import {
  HostReceivedData,
  isHostReceivedData,
  isPlayerReceivedData,
  PlayerReceivedData,
} from "./receivedData";

const gameType = "wavelength-v0" as const;
type ConnectionCustomMetadata = {
  name: string;
};
type ConnectionMetadata = ConnectionCustomMetadata & {
  gameType: typeof gameType;
};
function isConnectionMetadata(obj: unknown): obj is ConnectionMetadata {
  return (
    !!obj &&
    typeof obj === "object" &&
    "gameType" in obj &&
    obj.gameType === gameType &&
    "name" in obj &&
    typeof obj.name === "string" &&
    obj.name.trim().length > 0
  );
}

export async function hostGame(myName: string): Promise<HostInterface> {
  const peer = await preparePeerConnection();

  const hostHandler = createHostDataHandler({
    gameId: peer.id,
    name: myName,
  });

  async function sendToAll(
    data:
      | PlayerReceivedData
      | ((user: HostData["users"][number]) => PlayerReceivedData),
  ) {
    await Promise.all(
      hostHandler.data.users.map((user) =>
        user.connection?.send(typeof data === "function" ? data(user) : data),
      ),
    );
  }

  async function sharePlayerList() {
    const players = hostHandler.data.users.map((x) => ({
      id: x.id,
      name: x.name,
      score: x.score,
    }));
    await sendToAll((user) => ({
      type: "playerList",
      players: players,
      myId: user.id,
      myName: user.name,
    }));
  }

  async function kickPlayer(id: number) {
    const { player, finalChatText } = hostHandler.kickPlayer(id) ?? {};
    if (player) {
      player.connection?.close();
      await sharePlayerList();
      if (finalChatText) {
        await sendToAll({
          type: "chatText",
          text: finalChatText,
        });
      }
    }
  }

  async function sendToChat(
    playerId: number,
    playerName: string,
    text: string,
  ) {
    const finalText = hostHandler.chatMessage(playerName, text);
    if (!finalText) return;
    await sendToAll({
      type: "chatText",
      text: finalText,
    });
  }

  async function shareGameState() {
    await sendToAll({
      type: "sharedGameState",
      gameState: hostHandler.data.gameState,
    });
  }

  async function reportGuess(
    fromUserId: number,
    fromUserName: string,
    guess: number,
  ) {
    if (hostHandler.reportGuess(fromUserId, fromUserName, guess)) {
      await shareGameState();
      await sharePlayerList();
    }
  }

  async function reportTopic(
    fromUserId: number,
    data: { topic: string; side1: string; side2: string; result: number },
  ) {
    if (hostHandler.reportTopic(fromUserId, data)) {
      await shareGameState();
    }
  }

  async function reportReady(userId: number) {
    if (hostHandler.reportReady(userId)) {
      await shareGameState();
    }
  }

  async function startNewRound() {
    if (hostHandler.startNewRound()) {
      await shareGameState();
    }
  }

  async function finishGuessing() {
    if (hostHandler.finishGuessing()) {
      await shareGameState();
      await sharePlayerList();
    }
  }

  async function skipRound() {
    if (hostHandler.skipRound()) {
      await shareGameState();
    }
  }

  peer.on("close", () => {
    hostHandler.hostDisconnected();
  });

  peer.on("disconnected", () => {
    hostHandler.hostDisconnected();
  });

  peer.on("error", (e) => {
    console.error(e);
  });

  peer.on("connection", (connection) => {
    if (!isConnectionMetadata(connection.metadata)) {
      // path to close connection without notice
      connection.close();
      // path to close connection immediately - with notice
      // connection.on("open", () => {
      //   connection.close();
      // });
      return;
    }

    connection.on("close", async () => {
      try {
        const { player, finalChatText } =
          hostHandler.playerLeft(connection) ?? {};
        if (player) {
          await sharePlayerList();
          if (finalChatText) {
            await sendToAll({
              type: "chatText",
              text: finalChatText,
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    });

    connection.on("iceStateChanged", (state) => {
      if (
        state === "disconnected" ||
        state === "closed" ||
        state === "failed"
      ) {
        connection.close();
      }
    });

    connection.on("open", async () => {
      try {
        const connectedPlayer = hostHandler.newPlayer(connection);

        connection.on("data", async (data) => {
          try {
            if (!isHostReceivedData(data)) return;
            if (data.type === "chatRequest") {
              await sendToChat(
                connectedPlayer.id,
                connectedPlayer.name,
                data.text,
              );
            } else if (data.type === "reportGuess") {
              await reportGuess(
                connectedPlayer.id,
                connectedPlayer.name,
                data.guess,
              );
            } else if (data.type === "reportTopic") {
              await reportTopic(connectedPlayer.id, {
                result: data.result,
                side1: data.side1,
                side2: data.side2,
                topic: data.topic,
              });
            } else if (data.type === "reportReady") {
              await reportReady(connectedPlayer.id);
            }
          } catch (e) {
            console.error(e);
          }
        });

        await Promise.all([
          sharePlayerList().then(() => {
            sendToChat(0, "SYSTEM", `${connectedPlayer.name} joined the game.`);
          }),
          shareGameState(),
        ]);
      } catch (e) {
        console.error(e);
      }
    });

    connection.on("error", async (e) => {
      console.error(e);
    });
  });

  let onLeaveAction = () => {};

  return {
    isHost: true,
    data: hostHandler.data,
    setStep: async (step) => {
      if (hostHandler.setStep(step)) {
        await shareGameState();
      }
    },
    kickPlayer,
    startNewRound,
    finishGuessing,
    skipRound,
    sendToChat: async (text) => {
      await sendToChat(hostId, hostHandler.data.myName, text);
    },
    reportGuess: async (guess) => {
      await reportGuess(hostId, hostHandler.data.myName, guess);
    },
    reportTopic: async (data) => {
      await reportTopic(hostId, data);
    },
    reportReady: async () => {
      if (hostHandler.reportReady(hostId)) {
        shareGameState();
      }
    },
    leave: async () => {
      await sendToChat(0, "SYSTEM", "Host left the lobby. Game over.").catch(
        () => {},
      );
      hostHandler.hostDisconnected();
      peer.destroy();
      onLeaveAction();
    },
    onLeave: (action) => {
      onLeaveAction = action;
    },
  };
}

export async function connectToGame(
  toPeerId: string,
  metadata: ConnectionCustomMetadata,
): Promise<PlayerInterface> {
  let initialLoadReceived: undefined | Function,
    initialLoadRejected: undefined | Function;
  const initialTimeout = setTimeout(() => {
    initialLoadRejected?.();
  }, 10000);
  let peer: void | Peer;

  let initialLoad: Promise<void> | undefined = new Promise<void>(
    (received, rejected) => {
      initialLoadReceived = () => {
        initialLoadReceived = undefined;
        initialLoadRejected = undefined;
        clearTimeout(initialTimeout);
        received();
      };
      initialLoadRejected = () => {
        initialLoadReceived = undefined;
        initialLoadRejected = undefined;
        clearTimeout(initialTimeout);
        peer?.destroy();
        rejected();
      };
    },
  );
  // no unhandled rejection, handle it at "await" later
  initialLoad.catch(() => {});

  peer = await Promise.race([preparePeerConnection(), initialLoad]);
  if (!peer) throw "";

  const connection = await Promise.race([
    new Promise<DataConnection>((resolve, reject) => {
      const connection = peer.connect(toPeerId, {
        metadata: { ...metadata, gameType } satisfies ConnectionMetadata,
      });
      connection.on("error", reject);
      connection.on("close", reject);
      connection.on("open", () => {
        connection.off("error", reject);
        connection.off("close", reject);
        resolve(connection);
      });
    }),
    initialLoad,
  ]);
  if (!connection) throw Error();

  const playerHandler = createPlayerDataHandler(toPeerId);

  const sendToHost = (data: HostReceivedData) => connection.send(data);
  const sendToChat = async (text: string) => {
    if (!text?.trim()) return;
    try {
      await Promise.resolve(
        connection.send({
          type: "chatRequest",
          text: text.trim().slice(0, 256),
        } satisfies HostReceivedData),
      );
    } catch (e) {
      console.error(e);
    }
  };

  connection.on("error", (e) => {
    initialLoadRejected?.();
    console.error(e);
  });

  connection.on("close", () => {
    initialLoadRejected?.();
    playerHandler.playerDisconnected();
    playerHandler.chatMessage(`[SYSTEM]: Connection to host lost. Game over.`);
  });

  connection.on("iceStateChanged", (state) => {
    if (state === "disconnected" || state === "closed" || state === "failed") {
      connection.close();
    }
  });

  const reportGuess = async (guess: number) => {
    await sendToHost({
      type: "reportGuess",
      guess: guess,
    });
  };

  const reportTopic = async (args: {
    topic: string;
    side1: string;
    side2: string;
    result: number;
  }) => {
    await sendToHost({
      type: "reportTopic",
      ...args,
    });
  };

  const reportReady = async () => {
    await sendToHost({
      type: "reportReady",
    });
  };

  connection.on("data", (data) => {
    if (!isPlayerReceivedData(data)) return;

    if (data.type === "chatText") {
      playerHandler.chatMessage(data.text);
    } else if (data.type === "playerList") {
      playerHandler.updatePlayerList({
        players: data.players,
        myId: data.myId,
        myName: data.myName,
      }) && initialLoadReceived?.();
      return;
    } else if (data.type === "sharedGameState") {
      playerHandler.updateGameState(data.gameState) && initialLoadReceived?.();
      return;
    }
  });

  let onLeaveAction = () => {};
  const leave = () => {
    connection.close();
    onLeaveAction();
  };

  // without initial load within 10s this throws
  await initialLoad;

  return {
    isHost: false,
    data: playerHandler.data,
    reportGuess,
    reportTopic,
    reportReady,
    sendToChat,
    leave,
    onLeave(action) {
      onLeaveAction = action;
    },
  };
}
