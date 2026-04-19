import { Match, Show, Switch } from "solid-js";
import { hostId, UserInterface } from "../utils/gameState";
import { List } from "@solid-primitives/list";
import { Chat } from "./Chat";

export function GameInfoPanel(props: { gameInterface: UserInterface }) {
  return (
    <div class="flex flex-col h-full overflow-hidden p-1">
      <div class="flex flex-wrap gap-2 font-medium text-right p-2 justify-end">
        <Show when={props.gameInterface.isHost}>
          <span class="text-secondary">Hosting</span>
        </Show>
        <Show
          when={props.gameInterface.data.isConnected}
          fallback={<span class="text-warning">Disconnected</span>}
        >
          <span class="text-success">Connected</span>
        </Show>
        <button
          class="font-medium px-2! py-0!"
          onClick={() => props.gameInterface.leave()}
        >
          Leave lobby ✖
        </button>
      </div>

      <div class="text-center">
        Game Id <span class="text-secondary">(click to copy)</span>
        <div
          class="clickable-text text-sm"
          onClick={(e) => {
            navigator.clipboard.writeText(props.gameInterface.data.gameId);
            if (
              "createTextRange" in document.body &&
              document.body.createTextRange
            ) {
              const range = (document.body.createTextRange as any)();
              range.moveToElementText(e.target);
              range.select();
            } else if (window.getSelection) {
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(e.target);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }}
        >
          {props.gameInterface.data.gameId}
        </div>
      </div>

      <div class="flex flex-col gap-1 grow overflow-x-hidden overflow-y-auto text-left">
        <List
          each={props.gameInterface.data.users.toSorted(
            (a, b) => b.score - a.score,
          )}
        >
          {(user) => {
            return (
              <div class="relative flex flex-col outline outline-background-muted m-1 rounded-xl px-4 py-2">
                <div class="overflow-x-auto whitespace-nowrap">
                  {user().name}
                </div>
                <div class="flex flex-wrap justify-between">
                  <span class="text-success">
                    {user().score.toFixed(2)} points
                  </span>
                  <div>
                    <span class="text-secondary text-sm content-center">
                      ({user().id}
                      <Switch>
                        <Match
                          when={user().id === props.gameInterface.data.myId}
                        >
                          {" "}
                          - you
                        </Match>
                        <Match when={user().id === hostId}> - host</Match>
                      </Switch>
                      )
                    </span>
                    <Show when={props.gameInterface.isHost && user().id !== 1}>
                      <button
                        class="px-1! py-0! text-xs! ml-2"
                        onClick={() => {
                          if (props.gameInterface.isHost === true) {
                            props.gameInterface.kickPlayer(user().id);
                          }
                        }}
                      >
                        ✖ Kick
                      </button>
                    </Show>
                  </div>
                </div>
              </div>
            );
          }}
        </List>
      </div>

      <div class="h-[50vh]">
        <Chat
          chatLines={props.gameInterface.data.chatLines}
          sendToChat={props.gameInterface.sendToChat}
          isConnected={props.gameInterface.data.isConnected}
        />
      </div>
    </div>
  );
}
