import { List } from "@solid-primitives/list";
import { createMemo, createSignal } from "solid-js";

export function Chat(props: {
  chatLines: string[];
  sendToChat: (text: string) => Promise<void>;
  isConnected: boolean;
}) {
  const [chatText, setChatText] = createSignal("");

  return (
    <div class="flex flex-col outline outline-secondary m-px h-full">
      <div>
        <form
          class="flex w-full justify-center"
          onSubmit={(e) => {
            e.preventDefault();
            props.sendToChat(chatText().trim());
            setChatText("");
          }}
        >
          <input
            class="grow min-w-20"
            type="text"
            maxLength={256}
            value={chatText()}
            onInput={(e) => setChatText(e.target.value)}
            disabled={!props.isConnected}
          />
          <button
            type="submit"
            disabled={!props.isConnected}
          >
            Send
          </button>
        </form>
      </div>
      <div class="grow wrap-anywhere break-normal text-left p-2 overflow-y-scroll">
        <List each={props.chatLines.toReversed()}>
          {(line) => {
            const parts = createMemo(() => {
              const l = line();
              const index = l.indexOf("]:") + 1;
              return [l.slice(0, index), l.slice(index)];
            });
            return (
              <div>
                <span class="text-secondary">{parts()[0]}</span>
                <span>{parts()[1]}</span>
              </div>
            );
          }}
        </List>
      </div>
    </div>
  );
}
