import { List } from "@solid-primitives/list";
import { createSignal, createMemo, Show, createEffect } from "solid-js";
import {
  availableSteps,
  GamePhase,
  getGamePhase,
  getNextMasterPlayer,
  UserInterface,
} from "../utils/gameState";
import { TheLine } from "./TheLine";
import { PlayersWaitingIndicator } from "./PlayersWaitingIndicator";
import { isFilled } from "../utils/emptycheck";
import { getRandomOptions, getRandomTopic } from "../utils/wavelengthExamples";

export function WavelengthGame(props: { gameInterface: UserInterface }) {
  const [waiting, setWaiting] = createSignal(false);
  const [myGuess, setMyGuess] = createSignal(0);
  const [topic, setTopic] = createSignal("");
  const [side1, setSide1] = createSignal("");
  const [side2, setSide2] = createSignal("");

  const gamePhase = createMemo(() =>
    getGamePhase(props.gameInterface.data.gameState),
  );
  const imMaster = createMemo(
    () =>
      props.gameInterface.data.gameState.masterPlayerId ===
      props.gameInterface.data.myId,
  );
  const guessReported = createMemo(() =>
    props.gameInterface.data.gameState.aleradyAnsweredPlayerIds?.includes(
      props.gameInterface.data.myId || -1,
    ),
  );
  const readyReported = createMemo(() =>
    props.gameInterface.data.gameState.readyPlayerIds?.includes(
      props.gameInterface.data.myId || -1,
    ),
  );
  const nextMasterPlayer = createMemo(() =>
    getNextMasterPlayer(
      props.gameInterface.data.users,
      props.gameInterface.data.gameState.masterPlayerId,
    ),
  );
  const step = createMemo(() => props.gameInterface.data.gameState.step ?? 1);
  const originalResult = createMemo(() =>
    props.gameInterface.data.gameState.finalResults?.find(
      (x) => x.playerId === props.gameInterface.data.gameState.masterPlayerId,
    ),
  );

  createEffect(() => {
    if (gamePhase() === GamePhase.MasterPlayerSetup) {
      setTopic("");
      setSide1("");
      setSide2("");
      setMyGuess(0);
    }
  });

  return (
    <div class="flex flex-col gap-8 p-4 pt-20 w-full">
      <Show when={gamePhase() === GamePhase.WaitingForPlayers}>
        <div class="outline outline-secondary p-2 rounded-xl">
          <span>Settings</span>{" "}
          <span class="text-secondary">(only host can change)</span>
          <div>
            <span class="text-secondary">Step = </span>
            <Show
              when={props.gameInterface.isHost}
              fallback={
                <div class="inline-block">
                  {props.gameInterface.data.gameState.step ?? 1}%
                </div>
              }
            >
              <select
                class="text-primary bg-background text-left border rounded"
                value={props.gameInterface.data.gameState.step ?? 1}
                onChange={(e) => {
                  if (!props.gameInterface.isHost) return;
                  props.gameInterface
                    .setStep?.(+e.target.value)
                    .catch(() => {});
                }}
              >
                <List each={availableSteps}>
                  {(val) => <option value={val()}>{val()}%</option>}
                </List>
              </select>
            </Show>
          </div>
          <div>
            <span class="text-secondary">Max points for guess = </span>
            <span class="text-primary">
              {100 / (props.gameInterface.data.gameState.step ?? 1)}
            </span>
          </div>
        </div>
        <span class="max-w-full w-full break-normal wrap-anywhere text-secondary text-center">
          Next clue master is{" "}
          <span class="text-primary">{nextMasterPlayer()?.name}</span>
        </span>
        <div class="flex w-full justify-center">
          <button
            class="max-w-min"
            onClick={async () => {
              setWaiting(true);
              await props.gameInterface.reportReady().catch(() => {});
              setTimeout(() => {
                setWaiting(false);
              }, 100);
            }}
            disabled={
              waiting() ||
              readyReported() ||
              props.gameInterface.data.users.length < 2
            }
          >
            Ready
          </button>
        </div>
        <hr />
        <PlayersWaitingIndicator
          label={
            props.gameInterface.data.users.length < 2
              ? "Need at least 2 players to start the game."
              : "Waiting for players to start..."
          }
          allPlayers={props.gameInterface.data.users}
          readyPlayersIds={props.gameInterface.data.gameState.readyPlayerIds}
        />
        <Show when={props.gameInterface.isHost}>
          <div class="flex w-full justify-center">
            <button
              class="outline-warning!"
              onClick={async () => {
                if (!props.gameInterface.isHost) return;
                setWaiting(true);
                await props.gameInterface.startNewRound().catch(() => {});
                setTimeout(() => {
                  setWaiting(false);
                }, 100);
              }}
              disabled={waiting() || props.gameInterface.data.users.length < 2}
            >
              Start anyway
            </button>
          </div>
        </Show>
        <hr />
      </Show>

      <Show
        when={
          isFilled(props.gameInterface.data.gameState.topic) ||
          (gamePhase() === GamePhase.MasterPlayerSetup && imMaster())
        }
      >
        <Show when={gamePhase() === GamePhase.WaitingForPlayers}>
          <span class="max-w-full w-full break-normal wrap-anywhere text-center text-3xl text-accent">
            Last round results:
          </span>
        </Show>
        <div class="flex flex-col gap-4 p-2">
          <div class="w-full flex justify-center">
            <div class="max-w-2/3 text-center text-xl">
              <Show
                when={gamePhase() === GamePhase.MasterPlayerSetup && imMaster()}
                fallback={props.gameInterface.data.gameState.topic || "Nothing"}
              >
                <div class="flex flex-col max-w-full items-center gap-8">
                  <div class="text-lg max-w-full break-normal wrap-anywhere text-secondary text-center">
                    Propose topic, two options and select where you lie on the
                    scale between them. Later other players will try to guess
                    what you selected on the scale. <br />
                    <br />
                    The closer they guess to your answer, the more points they
                    get.{" "}
                    <Show
                      when={props.gameInterface.data.users.length > 2}
                      fallback={
                        "You get the points the other player didn't get."
                      }
                    >
                      You get average points from players with the most points,
                      substracted by average points of the other half.
                    </Show>
                  </div>

                  <input
                    class="min-w-20 max-w-full w-full"
                    placeholder="Topic"
                    type="text"
                    maxLength={256}
                    onInput={(e) => setTopic(e.target.value)}
                    value={topic()}
                    disabled={waiting()}
                  />

                  <div class="flex flex-col">
                    <button
                      class="text-secondary! outline-secondary!"
                      onClick={() => {
                        setTopic(getRandomTopic());
                      }}
                    >
                      Set random topic
                    </button>
                    <button
                      class="text-secondary! outline-secondary!"
                      onClick={() => {
                        const [option1, option2] = getRandomOptions();
                        setSide1(option1);
                        setSide2(option2);
                      }}
                    >
                      Set random options
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </div>
          <div class="flex flex-wrap max-w-full justify-between items-end wrap-anywhere break-normal text-xl">
            <div class="flex text-left max-w-2/5 min-w-max">
              <Show
                when={gamePhase() === GamePhase.MasterPlayerSetup && imMaster()}
                fallback={props.gameInterface.data.gameState.side1 || "Nothing"}
              >
                <input
                  class="min-w-40 max-w-full w-full"
                  placeholder="First option"
                  type="text"
                  maxLength={256}
                  onInput={(e) => setSide1(e.target.value)}
                  value={side1()}
                  disabled={waiting()}
                />
              </Show>
            </div>
            <div class="flex text-right max-w-2/5 min-w-max">
              <Show
                when={gamePhase() === GamePhase.MasterPlayerSetup && imMaster()}
                fallback={props.gameInterface.data.gameState.side2 || "Nothing"}
              >
                <input
                  class="min-w-40 max-w-full w-full"
                  placeholder="Second option"
                  type="text"
                  maxLength={256}
                  onInput={(e) => setSide2(e.target.value)}
                  value={side2()}
                  disabled={waiting()}
                />
              </Show>
            </div>
          </div>
        </div>

        <Show when={gamePhase() === GamePhase.MasterPlayerSetup && imMaster()}>
          <TheLine
            value={myGuess()}
            onValueChange={setMyGuess}
            disabled={waiting()}
            step={step()}
          />
          <div class="flex justify-center">
            <button
              class="max-w-min"
              onClick={async () => {
                const data = {
                  result: myGuess(),
                  side1: side1().trim(),
                  side2: side2().trim(),
                  topic: topic().trim(),
                };
                if (!data.side1 || !data.side2 || !data.topic) return;

                setWaiting(true);
                await props.gameInterface
                  .reportTopic({
                    result: myGuess(),
                    side1: side1(),
                    side2: side2(),
                    topic: topic(),
                  })
                  .catch(() => {});
                setTimeout(() => {
                  setWaiting(false);
                }, 100);
              }}
              disabled={
                waiting() ||
                !side1().trim() ||
                !side2().trim() ||
                !topic().trim()
              }
            >
              Confirm
            </button>
          </div>
        </Show>
      </Show>

      <Show when={gamePhase() === GamePhase.MasterPlayerSetup && !imMaster()}>
        <span class="max-w-full w-full break-normal wrap-anywhere text-secondary text-center">
          Wait for{" "}
          <span class="text-primary">
            {props.gameInterface.data.gameState.masterPlayerName}
          </span>{" "}
          to set up the question.
        </span>
      </Show>

      <Show
        when={
          gamePhase() === GamePhase.MasterPlayerSetup &&
          props.gameInterface.isHost
        }
      >
        <div class="flex w-full justify-center">
          <button
            class="outline-warning!"
            onClick={async () => {
              if (!props.gameInterface.isHost) return;
              setWaiting(true);
              await props.gameInterface.skipRound().catch(() => {});
              setTimeout(() => {
                setWaiting(false);
              }, 100);
            }}
            disabled={waiting()}
          >
            End this round
          </button>
        </div>
      </Show>

      <Show when={gamePhase() === GamePhase.PlayersGuess}>
        <Show
          when={!imMaster()}
          fallback={
            <>
              <TheLine
                value={myGuess()}
                step={step()}
              />
              <span class="max-w-full w-full break-normal wrap-anywhere text-secondary text-center">
                Now wait for other players to guess your answer
              </span>
            </>
          }
        >
          <span class="max-w-full w-full break-normal wrap-anywhere text-secondary text-center">
            Now guess what{" "}
            <span class="text-primary">
              {props.gameInterface.data.gameState.masterPlayerName}
            </span>{" "}
            thinks about it. <br /> The closer your guess, the more points you
            get.
          </span>
          <TheLine
            value={myGuess()}
            onValueChange={setMyGuess}
            disabled={waiting() || guessReported()}
            step={step()}
          />
          <div class="flex justify-center">
            <button
              class="max-w-min"
              onClick={async () => {
                setWaiting(true);
                await props.gameInterface
                  .reportGuess(myGuess())
                  .catch(() => {});
                setTimeout(() => {
                  setWaiting(false);
                }, 100);
              }}
              disabled={waiting() || guessReported()}
            >
              Confirm
            </button>
          </div>
        </Show>

        <hr />
        <PlayersWaitingIndicator
          label="Waiting for guesses..."
          allPlayers={props.gameInterface.data.users.filter(
            (x) => x.id !== props.gameInterface.data.gameState.masterPlayerId,
          )}
          readyPlayersIds={
            props.gameInterface.data.gameState.aleradyAnsweredPlayerIds
          }
        />
        <Show when={props.gameInterface.isHost}>
          <div class="flex w-full justify-center">
            <button
              class="outline-warning!"
              onClick={async () => {
                if (!props.gameInterface.isHost) return;
                setWaiting(true);
                await props.gameInterface.finishGuessing().catch(() => {});
                setTimeout(() => {
                  setWaiting(false);
                }, 100);
              }}
              disabled={waiting()}
            >
              Finish anyway
            </button>
          </div>
        </Show>
        <hr />
      </Show>

      <Show when={isFilled(originalResult())}>
        <List
          each={props.gameInterface.data.gameState.finalResults?.toSorted(
            (a, b) =>
              Math.abs(a.guess - originalResult()!.guess) -
              Math.abs(b.guess - originalResult()!.guess),
          )}
        >
          {(final) => {
            return (
              <>
                <div>
                  <div class="flex justify-between max-w-full mb-2">
                    <div class="text-primary max-w-full break-normal wrap-anywhere">
                      {final().playerName}
                    </div>
                    <div class="text-success text-end font-bold">
                      +{final().points.toFixed(2)}
                    </div>
                  </div>
                  <TheLine
                    value={final().guess}
                    step={1}
                  />
                </div>
                <hr />
              </>
            );
          }}
        </List>
      </Show>
    </div>
  );
}
