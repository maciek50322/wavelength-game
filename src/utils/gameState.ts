import { DataConnection } from "peerjs";
import { createStore, produce } from "solid-js/store";
import { isEmpty, isFilled } from "./emptycheck";

export const availableSteps = [1, 2, 5, 10, 25] as const;
const minResult = -50;
const maxResult = 50;

export enum GamePhase {
  WaitingForPlayers,
  MasterPlayerSetup,
  PlayersGuess,
}
export function getGamePhase(gs: PlayerGameState) {
  // master sits, no topic yet
  if (isFilled(gs.masterPlayerId) && isEmpty(gs.topic)) {
    return GamePhase.MasterPlayerSetup;
  }
  // topic defined, no shared result yet
  if (isFilled(gs.topic) && isEmpty(gs.finalResults)) {
    return GamePhase.PlayersGuess;
  }
  return GamePhase.WaitingForPlayers;
}

// game data
export type PlayerGameState = {
  step?: number;

  roundStartedTime?: number;
  masterPlayerId?: number;
  masterPlayerName?: string;
  topic?: string;
  side1?: string;
  side2?: string;

  answersStartedTime?: number;
  aleradyAnsweredPlayerIds?: number[];

  finalResults?: {
    playerId: number;
    playerName: string;
    guess: number;
    points: number;
  }[];

  readyPlayerIds?: number[];
};

export type HostGameState = {
  originalResult?: number;
  reportedGuesses?: { playerId: number; playerName: string; guess: number }[];
};

// whole operational data
export type HostData = {
  gameId: string;
  isConnected: boolean;
  myId: number;
  myName: string;
  users: {
    connection?: DataConnection;
    id: number;
    name: string;
    score: number;
  }[];
  chatLines: string[];
  gameState: PlayerGameState;
  hostGameState: HostGameState;
};

export type PlayerData = {
  gameId: string;
  isConnected: boolean;
  myId?: number;
  myName?: string;
  users: { id: number; name: string; score: number }[];
  chatLines: string[];
  gameState: PlayerGameState;
};

// game controls
export type HostInterface = {
  isHost: true;
  data: HostData;
  setStep: (step: number) => Promise<void>;
  startNewRound: () => Promise<void>;
  finishGuessing: () => Promise<void>;
  skipRound: () => Promise<void>;
  kickPlayer: (id: number) => Promise<void>;
  sendToChat: (text: string) => Promise<void>;
  reportGuess: (guess: number) => Promise<void>;
  reportTopic: (args: {
    topic: string;
    side1: string;
    side2: string;
    result: number;
  }) => Promise<void>;
  reportReady: () => Promise<void>;
  leave: () => void;
  onLeave: (action: () => void) => void;
};

export type PlayerInterface = {
  isHost: false;
  data: PlayerData;
  sendToChat: (text: string) => Promise<void>;
  reportGuess: (guess: number) => Promise<void>;
  reportTopic: (args: {
    topic: string;
    side1: string;
    side2: string;
    result: number;
  }) => Promise<void>;
  reportReady: () => Promise<void>;
  leave: () => void;
  onLeave: (action: () => void) => void;
};

export type UserInterface = HostInterface | PlayerInterface;

export const hostId = 1;

export function createHostDataHandler(args: { gameId: string; name: string }) {
  let nextId = hostId;
  const [hostData, setHostData] = createStore<HostData>({
    gameId: args.gameId,
    isConnected: true,
    myId: nextId,
    myName: args.name,
    users: [
      {
        id: nextId,
        name: args.name,
        score: 0,
      },
    ],
    chatLines: [
      "[SYSTEM]: This lobby will work as long as the host (you) is online.",
    ],
    gameState: {
      step: 5 satisfies (typeof availableSteps)[number],
    },
    hostGameState: {},
  });
  nextId++;

  /**
   * Changes step for game, can be only set before round starts
   * @returns if the step was changed
   */
  function setStep(newStep: number) {
    if (!availableSteps.includes(newStep as any)) return false;
    setHostData(produce((x) => (x.gameState.step = newStep)));
    return true;
  }

  /**
   * When player is no longer in lobby, but didn't finish his turn, there are side effects
   */
  function fixGamePhaseOnPlayerLeave(playerId: number) {
    const gameState = hostData.gameState;
    const gamePhase = getGamePhase(gameState);
    const masterPlayerId = gameState.masterPlayerId;
    const answeredPlayerIds = gameState.aleradyAnsweredPlayerIds;
    const readyPlayerIds = gameState.readyPlayerIds;
    const users = hostData.users;

    if (
      gamePhase === GamePhase.MasterPlayerSetup &&
      masterPlayerId === playerId
    ) {
      skipRound();
    } else if (
      gamePhase === GamePhase.PlayersGuess &&
      masterPlayerId !== playerId &&
      !answeredPlayerIds?.includes(playerId) &&
      users.length <= (answeredPlayerIds?.length ?? 0) &&
      users.every(
        (m) => answeredPlayerIds?.includes(m.id) || m.id === masterPlayerId,
      )
    ) {
      finishGuessing();
    } else if (
      gamePhase === GamePhase.WaitingForPlayers &&
      !readyPlayerIds?.includes(playerId) &&
      users.length <= (readyPlayerIds?.length ?? 0) &&
      users.every((m) => readyPlayerIds?.includes(m.id))
    ) {
      if (users.length === 1) {
        setHostData(produce((x) => (x.gameState.readyPlayerIds = [])));
      } else {
        startNewRound();
      }
    }
  }

  /**
   * @returns which player was kicked and final chat text or undefined if couldn't kick
   */
  function kickPlayer(playerId: number) {
    if (playerId === hostId) return {}; // host shouldn't kick self
    const playerIndex = hostData.users.findIndex((x) => x.id === playerId);
    if (playerIndex < 0) return {};
    const player = hostData.users[playerIndex];
    setHostData(produce((x) => x.users.splice(playerIndex, 1)));
    const finalChatText = chatMessage(
      "SYSTEM",
      `${player.name} has been kicked with ${player.score.toFixed(2)} points`,
    );

    fixGamePhaseOnPlayerLeave(playerId);

    return { player, finalChatText };
  }

  /**
   * @returns which player left and final chat text or undefined if couldn't update
   */
  function playerLeft(connection: DataConnection) {
    const index = hostData.users.findIndex((x) => x.connection === connection);
    if (index < 0) return;
    const player = hostData.users[index];
    setHostData(produce((x) => x.users.splice(index, 1)));
    const finalChatText = chatMessage(
      "SYSTEM",
      `${player.name} left the game with ${player.score.toFixed(2)} points.`,
    );

    fixGamePhaseOnPlayerLeave(player.id);

    return { player, finalChatText };
  }

  /**
   * @returns New final message
   */
  function chatMessage(playerName: string, text: string) {
    if (!text || typeof text !== "string" || !text.trim()) return;
    const finalText = `[${playerName}]: ${text.trim().slice(0, 256)}`;
    setHostData(
      produce((x) => {
        x.chatLines.push(finalText);
        if (x.chatLines.length > 100) {
          x.chatLines.splice(0, x.chatLines.length - 100);
        }
      }),
    );
    return finalText;
  }

  /**
   * Finishes round even if not every player reported guess, shows results.
   * Can't finish guessing if it's not player guess phase.
   * @returns If guessing has been finished
   */
  function finishGuessing() {
    if (getGamePhase(hostData.gameState) !== GamePhase.PlayersGuess)
      return false;

    setHostData(
      produce((x) => {
        const originalAnswer = x.hostGameState.originalResult ?? 0;
        const step = x.gameState.step ?? 1;
        const guessersResults =
          x.hostGameState.reportedGuesses
            ?.map((r) => ({
              ...r,
              points: calculatePoints(originalAnswer, r.guess, step),
            }))
            .sort(
              (a, b) =>
                Math.abs(a.guess - originalAnswer) -
                Math.abs(b.guess - originalAnswer),
            ) ?? [];

        x.gameState.finalResults = [
          {
            guess: originalAnswer,
            playerId: x.gameState.masterPlayerId ?? 0,
            playerName: x.gameState.masterPlayerName ?? "",
            points: calculatePointsForMaster(
              guessersResults.map((r) => r.points),
              step,
            ),
          },
          ...guessersResults,
        ];

        const pointMap = new Map<number, number>();
        x.gameState.finalResults.forEach((r) => {
          pointMap.set(r.playerId, r.points);
        });

        x.users.forEach((m) => {
          m.score += pointMap.get(m.id) ?? 0;
        });

        x.gameState.readyPlayerIds = [];
      }),
    );

    return true;
  }
  /**
   * Same as finishGuessing(), but only when master player not finished setup, doesn't show results.
   * @returns If game restarted
   */
  function skipRound() {
    if (getGamePhase(hostData.gameState) !== GamePhase.MasterPlayerSetup)
      return false;

    setHostData(
      produce((x) => {
        x.gameState.finalResults = undefined;
        x.gameState.readyPlayerIds = [];
      }),
    );

    return true;
  }

  /**
   * @returns Wheter guess is valid and included it in game state
   */
  function reportGuess(
    fromUserId: number,
    fromUserName: string,
    guess: number,
  ) {
    if (
      hostData.gameState.masterPlayerId === fromUserId || // no report from master player
      getGamePhase(hostData.gameState) !== GamePhase.PlayersGuess || // wrong time to report - only during players guessing phase
      typeof guess !== "number" ||
      isNaN(guess) ||
      guess > maxResult ||
      guess < minResult ||
      guess % (hostData.gameState.step ?? 1) !== 0
    )
      return false;

    setHostData(
      produce((x) => {
        x.hostGameState.reportedGuesses ??= [];
        x.hostGameState.reportedGuesses.push({
          playerId: fromUserId,
          playerName: fromUserName,
          guess: guess,
        });
        x.gameState.aleradyAnsweredPlayerIds =
          x.hostGameState.reportedGuesses.map((r) => r.playerId);
      }),
    );

    if (
      hostData.users.length - 1 <=
        (hostData.gameState.aleradyAnsweredPlayerIds?.length ?? 0) &&
      hostData.users.every(
        (m) =>
          hostData.gameState.aleradyAnsweredPlayerIds?.includes(m.id) ||
          m.id === hostData.gameState.masterPlayerId,
      )
    ) {
      finishGuessing();
    }

    return true;
  }

  /**
   * @returns Whether reported topic is valid and included in game state
   */
  function reportTopic(
    fromUserId: number,
    reportData: { topic: string; side1: string; side2: string; result: number },
  ) {
    if (
      !reportData ||
      typeof reportData !== "object" ||
      hostData.gameState.masterPlayerId !== fromUserId || // only from master player
      getGamePhase(hostData.gameState) !== GamePhase.MasterPlayerSetup || // wrong time to report - only during master setup
      typeof reportData.result !== "number" ||
      isNaN(reportData.result) ||
      reportData.result > maxResult ||
      reportData.result < minResult ||
      reportData.result % (hostData.gameState.step ?? 1) !== 0 ||
      typeof reportData.topic !== "string" ||
      !reportData.topic.trim() ||
      typeof reportData.side1 !== "string" ||
      !reportData.side1.trim() ||
      typeof reportData.side2 !== "string" ||
      !reportData.side2.trim()
    )
      return false;

    setHostData(
      produce((x) => {
        x.hostGameState.originalResult = reportData.result; // result to host only
        x.gameState.side1 = reportData.side1.trim().slice(0, 256);
        x.gameState.side2 = reportData.side2.trim().slice(0, 256);
        x.gameState.topic = reportData.topic.trim().slice(0, 256);

        x.hostGameState.reportedGuesses = [];
        x.gameState.aleradyAnsweredPlayerIds = [];
        x.gameState.finalResults = undefined;
        x.gameState.answersStartedTime = Date.now();
      }),
    );
    return true;
  }

  /**
   * Starts round even if not every player was ready.
   * Can't start new round during player guess phase, but can finish guessing first
   * @returns If started new round
   */
  function startNewRound() {
    if (
      getGamePhase(hostData.gameState) === GamePhase.PlayersGuess ||
      hostData.users.length < 2
    )
      return false;

    setHostData(
      produce((x) => {
        x.hostGameState.originalResult = undefined;
        x.hostGameState.reportedGuesses = undefined;

        const nextMasterPlayer = getNextMasterPlayer(
          x.users,
          x.gameState.masterPlayerId,
        );

        x.gameState = {
          step: x.gameState.step,
          roundStartedTime: Date.now(),
          masterPlayerId: nextMasterPlayer?.id,
          masterPlayerName: nextMasterPlayer?.name,
          topic: undefined,
          side1: undefined,
          side2: undefined,

          answersStartedTime: undefined,
          aleradyAnsweredPlayerIds: undefined,
          finalResults: undefined,

          readyPlayerIds: undefined,
        };
      }),
    );

    return true;
  }

  /**
   * Setups readiness of players and might start next round
   * @returns If accepted the readiness (doesn't if player was already ready or ready at wrong time)
   */
  function reportReady(userId: number) {
    if (
      getGamePhase(hostData.gameState) !== GamePhase.WaitingForPlayers || // wrong time to be ready - game is on
      hostData.gameState.readyPlayerIds?.includes(userId) // already ready
    )
      return false;

    setHostData(
      produce((x) => {
        x.gameState.readyPlayerIds ??= [];
        x.gameState.readyPlayerIds.push(userId);
      }),
    );

    if (
      hostData.users.length <=
        (hostData.gameState.readyPlayerIds?.length ?? 0) &&
      hostData.users.every((m) =>
        hostData.gameState.readyPlayerIds?.includes(m.id),
      )
    ) {
      startNewRound();
    }

    return true;
  }

  /**
   * @returns The new player based on connection and it's metadata, assumes correct metadata type
   */
  function newPlayer(connection: DataConnection) {
    let name = connection.metadata.name.trim().slice(0, 20);
    let sameName = hostData.users.find((x) => x.name === name)?.name;
    while (sameName) {
      const lastNumber = name.match(/\d+$/);
      if (!lastNumber) {
        name += "1";
      } else {
        name =
          name.slice(0, lastNumber.index) + (+lastNumber[0] + 1).toString();
        if (name === sameName) {
          name += "e";
        }
      }
      sameName = hostData.users.find((x) => x.name === name)?.name;
    }
    const newPlayer = {
      connection,
      id: nextId++,
      name,
      score: 0,
    };
    setHostData(produce((x) => x.users.push(newPlayer)));
    return newPlayer;
  }

  /**
   * Sets host's state to disconnected
   */
  function hostDisconnected() {
    setHostData(produce((x) => (x.isConnected = false)));
  }

  return {
    data: hostData,
    setStep,
    kickPlayer,
    playerLeft,
    chatMessage,
    reportGuess,
    reportReady,
    reportTopic,
    newPlayer,
    hostDisconnected,
    finishGuessing,
    startNewRound,
    skipRound,
  };
}

export function createPlayerDataHandler(gameId: string) {
  const [playerData, setPlayerData] = createStore<PlayerData>({
    gameId: gameId,
    isConnected: true,
    users: [],
    chatLines: [],
    gameState: {},
  });

  /**
   * Updates chat with new message
   */
  function chatMessage(text: string) {
    if (!text || typeof text !== "string") return false;
    setPlayerData(
      produce((x) => {
        x.chatLines.push(text);
        if (x.chatLines.length > 100) {
          x.chatLines.splice(0, x.chatLines.length - 100);
        }
      }),
    );
    return true;
  }

  /**
   * Sets players's state to disconnected
   */
  function playerDisconnected() {
    setPlayerData(produce((x) => (x.isConnected = false)));
  }

  /**
   * Updates user list
   */
  function updateUserList(data: {
    players: PlayerData["users"];
    myId: number;
    myName: string;
  }) {
    if (
      !data ||
      typeof data !== "object" ||
      typeof data.myId !== "number" ||
      isNaN(data.myId) ||
      data.myId < hostId ||
      typeof data.myName !== "string" ||
      typeof data.players !== "object" ||
      !Array.isArray(data.players) ||
      data.players.some(
        (x) =>
          typeof x !== "object" ||
          typeof x.id !== "number" ||
          typeof x.score !== "number",
      )
    )
      return false;
    setPlayerData(
      produce((x) => {
        x.users = data.players;
        x.myId = data.myId;
        x.myName = data.myName;
      }),
    );
    return true;
  }

  /**
   * Updates game state
   */
  function updateGameState(gameState: PlayerGameState) {
    if (!gameState || typeof gameState !== "object") return false;
    setPlayerData(produce((x) => (x.gameState = gameState)));
    return true;
  }

  return {
    data: playerData,
    chatMessage,
    playerDisconnected,
    updatePlayerList: updateUserList,
    updateGameState,
  };
}

export function getNextMasterPlayer(
  players: { id: number; name: string }[],
  lastMasterId?: number,
) {
  if (players.length === 0) return undefined;
  if (players.length === 1) return players[0];
  lastMasterId ??= 0;
  let foundPlayer = players.find((x) => x.id > lastMasterId);
  if (foundPlayer) return foundPlayer;
  let minIdPlayer = players[0];
  if (minIdPlayer === undefined) return undefined;
  for (let i = 1; i < players.length; i++) {
    if (minIdPlayer.id > players[i].id) {
      minIdPlayer = players[i];
    }
  }
  return minIdPlayer;
}

/**
 * Closer to target = more points
 * Perfect hits give much more points
 * No full point after error of 25
 * Less points for bigger steps (less options)
 */
export function calculatePoints(
  originalAnswer: number,
  guess: number,
  step: number,
) {
  const d = Math.abs(originalAnswer - guess);
  return Math.pow(100 / step, 1 - d / 25);
}

/**
 * Takes best scored guess points and substracts average points of the rest of guesses
 * If players all guess the same, less points.
 * For only one guess take all points it didn't score.
 */
export function calculatePointsForMaster(
  guesserPoints: number[] | undefined,
  step: number,
) {
  if (!guesserPoints?.length) return 0;
  if (guesserPoints.length === 1) {
    return 100 / step - guesserPoints[0];
  }

  // should be sorted by proximity ascending, that makes points sorted descending, sort the same way
  guesserPoints.sort((a, b) => b - a);

  let bestGroupScoreSum = 0;
  const bestTo = Math.floor(guesserPoints.length / 2);
  for (let i = 0; i < bestTo; i++) {
    bestGroupScoreSum += guesserPoints[i];
  }
  const avgBest = bestGroupScoreSum / Math.floor(guesserPoints.length / 2);

  let worstGroupScoreSum = 0;
  const worstFrom = Math.ceil(guesserPoints.length / 2);
  for (let i = worstFrom; i < guesserPoints.length; i++) {
    worstGroupScoreSum += guesserPoints[i];
  }
  const avgWorst = worstGroupScoreSum / Math.floor(guesserPoints.length / 2);

  return Math.max(0, avgBest - avgWorst);
}
