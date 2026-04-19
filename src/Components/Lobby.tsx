import { UserInterface } from "../utils/gameState";
import { GameInfoPanel } from "./GameInfoPanel";
import { WavelengthGame } from "./WavelengthGame";

export function Lobby(props: { gameInterface: UserInterface }) {
  return (
    <div class="flex flex-wrap w-full h-screen overflow-x-hidden overflow-y-auto items-stretch">
      <div class="flex flex-12 min-w-2/3 justify-center">
        <div class="w-full lg:max-w-[67vw]">
          <WavelengthGame gameInterface={props.gameInterface} />
        </div>
      </div>
      <div class="h-full overflow-hidden w-80 min-w-48 flex-1/12 basis-80 sticky top-0">
        <GameInfoPanel gameInterface={props.gameInterface} />
      </div>
    </div>
  );
}
