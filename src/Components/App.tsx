import { Match, Switch, type Component } from "solid-js";
import { Welcome } from "./Welcome";
import { createStore } from "solid-js/store";
import { Lobby } from "./Lobby";
import { UserInterface } from "../utils/gameState";
import { isEmpty, isFilled } from "../utils/emptycheck";

const App: Component = () => {
  const [gameInterface, setGameInterface] = createStore<
    UserInterface | { isHost: undefined }
  >({ isHost: undefined });

  return (
    <Switch>
      <Match when={isEmpty(gameInterface.isHost)}>
        <Welcome
          onJoin={(gi) => {
            gi.onLeave(() => {
              setGameInterface({ isHost: undefined });
            });
            setGameInterface(gi);
            const url = new URL(document.URL);
            url.searchParams.set("gameId", gi.data.gameId);
            window.history.replaceState(undefined, document.title, url);
            // window.history.pushState(undefined, document.title, url);
          }}
        />
      </Match>
      <Match when={isFilled(gameInterface.isHost)}>
        <Lobby gameInterface={gameInterface as UserInterface} />
      </Match>
    </Switch>
  );
};

export default App;
