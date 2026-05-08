import { MenuList } from "./MenuList";
import { NowPlaying } from "./NowPlaying";
import type { PlayerState } from "../state/api";
import type { Frame } from "../state/types";
import { titleFor } from "../state/loadView";

type Props = {
  frame: Frame;
  player: PlayerState | null;
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

export function Screen({ frame, player, onActivate }: Props) {
  const isNowPlaying = frame.view.kind === "now-playing";

  return (
    <div
      className="ipod-screen rounded-lg overflow-hidden flex flex-col relative"
      style={{ width: 368, height: 300 }}
    >
      <div className="ipod-titlebar h-5 flex items-center justify-between px-2 text-[11px] font-semibold text-black/80">
        <PlayIndicator player={player} />
        <span className="truncate">{titleFor(frame.view)}</span>
        <span className="w-5 flex justify-end">
          <span className="inline-block border border-black/60 rounded-sm px-0.75 py-px text-[8px] leading-none">
            ▮▮▮
          </span>
        </span>
      </div>

      {isNowPlaying && player ? (
        <NowPlaying state={player} />
      ) : (
        <MenuList
          items={frame.items}
          selected={frame.selected}
          onActivate={onActivate}
        />
      )}

      {!frame.loaded && !isNowPlaying && (
        <div className="absolute right-2 top-6 text-[10px] text-gray-500">
          …
        </div>
      )}
    </div>
  );
}
