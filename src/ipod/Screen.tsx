import { MenuList } from "./MenuList";
import { NowPlaying } from "./NowPlaying";
import { BatteryIcon } from "./BatteryIcon";
import type { PlayerState } from "../state/api";
import type { Frame } from "../state/types";
import { titleFor } from "../state/loadView";
import type { Battery } from "../hooks/useBattery";

type Props = {
  frame: Frame;
  player: PlayerState | null;
  battery: Battery;
  onActivate: (i: number) => void;
};

function PlayIndicator({ player }: { player: PlayerState | null }) {
  return (
    <span className="w-4">
      {player?.state === "playing"
        ? "▶"
        : player?.state === "paused"
          ? "❚❚"
          : ""}
    </span>
  );
}

export function Screen({ frame, player, battery, onActivate }: Props) {
  const isNowPlaying = frame.view.kind === "now-playing";

  return (
    <div
      className="ipod-screen rounded-lg overflow-hidden flex flex-col relative"
      style={{ width: 368, height: 300 }}
    >
      <div className="ipod-titlebar h-5 flex items-center justify-between px-2 text-[11px] font-semibold text-black/80">
        <PlayIndicator player={player} />
        <span className="truncate">{titleFor(frame.view)}</span>
        <span className="flex justify-end">
          <BatteryIcon battery={battery} />
        </span>
      </div>

      {isNowPlaying && player ? (
        <NowPlaying state={player} />
      ) : (
        <MenuList
          items={frame.items}
          selected={frame.selected}
          loaded={frame.loaded}
          onActivate={onActivate}
        />
      )}

    </div>
  );
}
