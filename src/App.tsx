import { useCallback, useEffect, useReducer } from "react";
import { ClickWheel } from "./ipod/ClickWheel";
import { Screen } from "./ipod/Screen";
import { api } from "./state/api";
import { initialNav, keyOf, navReducer } from "./state/nav";
import { loadView, MUSIC_ITEMS } from "./state/loadView";
import { usePlayer } from "./hooks/usePlayer";
import { useBattery } from "./hooks/useBattery";
import { useQueue } from "./hooks/useQueue";
import { useNavKeyboard } from "./hooks/useNavKeyboard";

export default function App() {
  const [nav, dispatch] = useReducer(navReducer, initialNav);
  const player = usePlayer();
  const battery = useBattery();
  const { start: startQueue, step: stepQueue } = useQueue();

  const top = nav.stack[nav.stack.length - 1];
  const view = top.view;
  const viewKey = keyOf(view);

  // Re-fetch when the active view changes (and when player state flips while on
  // the root screen, so the "Now Playing" entry can appear/disappear).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items, tracks } = await loadView(view, player);
        if (!cancelled) dispatch({ type: "set-data", viewKey, items, tracks });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewKey,
    view.kind === "root" ? `${player?.state}|${!!player?.name}` : "",
  ]);

  const onScroll = useCallback(
    (delta: number) => dispatch({ type: "scroll", delta }),
    [],
  );
  const onMenu = useCallback(() => dispatch({ type: "pop" }), []);
  const onPlayPause = useCallback(() => {
    api.playpause().catch(() => {});
  }, []);
  const onNext = useCallback(() => stepQueue(1), [stepQueue]);
  const onPrev = useCallback(() => stepQueue(-1), [stepQueue]);

  const onSelect = useCallback(
    async (overrideIndex?: number) => {
      const i = overrideIndex ?? top.selected;
      if (overrideIndex !== undefined && overrideIndex !== top.selected) {
        dispatch({ type: "scroll", delta: overrideIndex - top.selected });
      }
      const item = top.items[i];

      switch (view.kind) {
        case "root": {
          if (!item) return;
          if (item.key === "music")
            dispatch({ type: "push", view: { kind: "music" } });
          else if (item.key === "now-playing")
            dispatch({ type: "push", view: { kind: "now-playing" } });
          else if (item.key === "shuffle") {
            await api.shuffle().catch(() => {});
            dispatch({ type: "push", view: { kind: "now-playing" } });
          }
          return;
        }
        case "music": {
          const m = MUSIC_ITEMS[i];
          if (m) dispatch({ type: "push", view: m.view });
          return;
        }
        case "playlists":
          if (item)
            dispatch({
              type: "push",
              view: { kind: "playlist", id: item.key, name: item.label },
            });
          return;
        case "artists":
          if (item)
            dispatch({
              type: "push",
              view: { kind: "artist-albums", artist: item.key },
            });
          return;
        case "artist-albums":
          if (item)
            dispatch({
              type: "push",
              view: { kind: "album-tracks", album: item.key },
            });
          return;
        case "albums":
          if (item) {
            const [name] = item.key.split("|");
            dispatch({
              type: "push",
              view: { kind: "album-tracks", album: name },
            });
          }
          return;
        case "genres":
          if (item)
            dispatch({
              type: "push",
              view: { kind: "genre-tracks", genre: item.key },
            });
          return;
        case "playlist":
        case "album-tracks":
        case "songs":
        case "genre-tracks": {
          const t = top.tracks[i];
          if (!t) return;
          await startQueue(
            top.tracks,
            i,
            view.kind === "playlist" ? view.id : undefined,
          );
          dispatch({ type: "push", view: { kind: "now-playing" } });
          return;
        }
      }
    },
    [top, view, startQueue],
  );

  useNavKeyboard({ onScroll, onSelect, onMenu, onPlayPause, onNext, onPrev });

  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  // In Tauri mode the window is resizable; scale the iPod to fit while keeping
  // its 420×674 aspect ratio. We use CSS `zoom` (not `transform: scale`) so
  // click-wheel hit areas scale along with the visuals.
  useEffect(() => {
    if (!isTauri) return;
    const NATURAL_W = 440;
    const NATURAL_H = 700;
    const apply = () => {
      const z = Math.min(
        window.innerWidth / NATURAL_W,
        window.innerHeight / NATURAL_H,
      );
      document.documentElement.style.setProperty("--ipod-zoom", String(z));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [isTauri]);

  const ipod = (
    <div
      data-tauri-drag-region
      className="ipod-frame rounded-[44px] flex flex-col items-center"
      style={{ width: 420, padding: 26, paddingTop: 32 }}
    >
      <Screen
        frame={top}
        player={player}
        battery={battery}
        onActivate={onSelect}
      />
      <div style={{ height: 36 }} />
      <ClickWheel
        onScroll={onScroll}
        onSelect={onSelect}
        onMenu={onMenu}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onPrev={onPrev}
      />
    </div>
  );

  if (isTauri) return ipod;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {ipod}
    </div>
  );
}
