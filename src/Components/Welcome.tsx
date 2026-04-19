import { createSignal } from "solid-js";
import { connectToGame, hostGame } from "../utils/gameConnection";
import { UserInterface } from "../utils/gameState";

export function Welcome(props: {
  onJoin: (userInterface: UserInterface) => void;
}) {
  const [connId, setConnId] = createSignal(
    new URL(document.URL).searchParams.get("gameId") || "",
  );
  const [myName, setMyName] = createSignal(
    localStorage.getItem("username") || "",
  );
  const [waiting, setWaiting] = createSignal(false);

  const [error, setError] = createSignal("");

  return (
    <div class="min-h-screen bg-transparent flex flex-col justify-center content-center text-center align-middle p-4 m-0 overflow-auto gap-8">
      <div class="text-6xl my-6 wrap-anywhere break-normal">
        Wavelength Game
        <div class="text-lg max-w-full break-normal wrap-anywhere text-secondary text-center mt-8">
          Online multiplayer turn-based party game to guess what others think.
        </div>
      </div>
      <div class="flex justify-center mx-12">
        <input
          class="w-98 max-w-full min-w-20"
          type="text"
          placeholder="Your name (required)"
          value={myName()}
          onInput={(e) => setMyName(e.target.value)}
          maxLength={20}
        />
      </div>
      <div class="flex flex-wrap justify-center">
        <input
          type="text"
          placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
          class="w-98 max-w-full min-w-20"
          value={connId()}
          onInput={(e) => setConnId(e.target.value)}
        />
        <button
          onClick={async () => {
            setError("");
            const name = myName()?.trim();
            const connection = connId()?.trim();
            if (!name?.length || !connection?.length) return;
            setWaiting(true);
            try {
              const gameInterface = await connectToGame(connection, { name });
              localStorage.setItem("username", name);
              props.onJoin(gameInterface);
            } catch {
              setError(
                "Couldn't join the game. Make sure you are online and given game id is correct, open and hosted.",
              );
            }
            setWaiting(false);
          }}
          disabled={
            !myName()?.trim().length || !connId()?.trim().length || waiting()
          }
        >
          Join game
        </button>
      </div>
      OR
      <div>
        <button
          onClick={async () => {
            setError("");
            const name = myName()?.trim();
            if (!name?.length) return;
            setWaiting(true);
            try {
              const gameInterface = await hostGame(name);
              localStorage.setItem("username", name);
              props.onJoin(gameInterface);
            } catch {
              setError("Couldn't host the game. Make sure you are online.");
            }
            setWaiting(false);
          }}
          disabled={!myName()?.trim().length || waiting()}
        >
          Host game
        </button>
      </div>
      <div class="text-center text-warning h-4">{error()}</div>
    </div>
  );
}
