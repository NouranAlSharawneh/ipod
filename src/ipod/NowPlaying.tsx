import type { PlayerState } from "../state/api";
import { api } from "../state/api";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export function NowPlaying({ state }: { state: PlayerState }) {
  const pct = state.duration
    ? Math.min(100, (state.position / state.duration) * 100)
    : 0;
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center px-4 py-3 text-black">
      <div className="w-36 h-36 bg-black/20 rounded shadow-md mb-3 overflow-hidden flex items-center justify-center shrink-0">
        {state.id ? (
          <img
            src={api.artworkUrl(state.id)}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="text-[13px] font-semibold truncate w-full text-center">
        {state.name || "—"}
      </div>
      <div className="text-[11px] truncate w-full text-center opacity-80">
        {state.artist}
      </div>
      <div className="text-[11px] truncate w-full text-center opacity-60">
        {state.album}
      </div>
      <div className="mt-auto w-full">
        <div className="flex justify-between text-[10px] opacity-70">
          <span>{fmt(state.position)}</span>
          <span>-{fmt(Math.max(0, state.duration - state.position))}</span>
        </div>
        <div className="h-1.5 bg-black/20 rounded overflow-hidden">
          <div className="h-full bg-black/70" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
