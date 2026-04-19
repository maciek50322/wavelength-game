import { List } from "@solid-primitives/list";
import { Show } from "solid-js";

export function PlayersWaitingIndicator(props: {
  allPlayers?: { id: number; name: string }[];
  readyPlayersIds?: number[];
  label?: string;
}) {
  return (
    <div class="min-w-0 flex flex-row flex-wrap justify-center gap-4">
      <Show when={props.label}>
        <span class="max-w-full w-full break-normal wrap-anywhere text-secondary text-center">
          {props.label}
        </span>
      </Show>
      <List each={props.allPlayers}>
        {(user) => {
          return (
            <div
              classList={{
                "outline-success text-success": props.readyPlayersIds?.includes(
                  user().id,
                ),
              }}
              class="whitespace-nowrap outline px-3 rounded-xl max-w-full overflow-x-auto text-nowrap overflow-y-hidden min-w-0"
            >
              {user().name}
            </div>
          );
        }}
      </List>
    </div>
  );
}
