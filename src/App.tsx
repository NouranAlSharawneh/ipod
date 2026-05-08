import { useCallback, useEffect, useReducer, useState } from "react";
import { ClickWheel } from "./ipod/ClickWheel";
import { MenuList, type MenuItem } from "./ipod/MenuList";
import { NowPlaying } from "./ipod/NowPlaying";
import { api, type PlayerState, type Track } from "./state/api";

type View =
  | { kind: "root" }
  | { kind: "music" }
  | { kind: "playlists" }
  | { kind: "playlist"; id: string; name: string }
  | { kind: "artists" }
  | { kind: "artist-albums"; artist: string }
  | { kind: "albums" }
  | { kind: "album-tracks"; album: string }
  | { kind: "songs" }
  | { kind: "genres" }
  | { kind: "genre-tracks"; genre: string }
  | { kind: "now-playing" };

type Frame = { view: View; selected: number };
type NavState = { stack: Frame[] };
type NavAction =
  | { type: "push"; view: View }
  | { type: "pop" }
  | { type: "scroll"; delta: number; max: number };

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "push":
      return { stack: [...state.stack, { view: action.view, selected: 0 }] };
    case "pop":
      if (state.stack.length <= 1) return state;
      return { stack: state.stack.slice(0, -1) };
    case "scroll": {
      const top = state.stack[state.stack.length - 1];
      if (!top) return state;
      const next = Math.max(
        0,
        Math.min(action.max - 1, top.selected + action.delta),
      );
      if (next === top.selected) return state;
      return {
        stack: [...state.stack.slice(0, -1), { ...top, selected: next }],
      };
    }
  }
}

const MUSIC_ITEMS: { label: string; view: View }[] = [
  { label: "Playlists", view: { kind: "playlists" } },
  { label: "Artists", view: { kind: "artists" } },
  { label: "Albums", view: { kind: "albums" } },
  { label: "Songs", view: { kind: "songs" } },
  { label: "Genres", view: { kind: "genres" } },
];

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export default function App() {
  const [nav, dispatch] = useReducer(navReducer, {
    stack: [{ view: { kind: "root" }, selected: 0 }],
  });
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [itemsKey, setItemsKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<{
    tracks: Track[];
    index: number;
    playlistId?: string;
  } | null>(null);

  const top = nav.stack[nav.stack.length - 1];
  const view = top.view;
  const viewKey = JSON.stringify(view);

  // Load items for current view
  useEffect(() => {
    let cancelled = false;
    const myKey = viewKey;
    const apply = (next: MenuItem[], nextTracks: Track[] = []) => {
      if (cancelled) return;
      setItems(next);
      setTracks(nextTracks);
      setItemsKey(myKey);
    };
    async function load() {
      setLoading(true);
      try {
        if (view.kind === "root") {
          const showNP = player && player.state !== "stopped" && !!player.name;
          const list: MenuItem[] = [
            { key: "music", label: "Music", hasChildren: true },
          ];
          if (showNP)
            list.push({
              key: "now-playing",
              label: "Now Playing",
              hasChildren: true,
            });
          list.push({ key: "shuffle", label: "Shuffle Songs" });
          apply(list);
        } else if (view.kind === "music") {
          apply(
            MUSIC_ITEMS.map((m) => ({
              key: m.label,
              label: m.label,
              hasChildren: true,
            })),
          );
        } else if (view.kind === "playlists") {
          const pls = await api.playlists();
          apply(
            pls.map((p) => ({
              key: p.id,
              label: p.name,
              trailing: String(p.count),
              hasChildren: true,
            })),
          );
        } else if (view.kind === "playlist") {
          const ts = await api.playlistTracks(view.id);
          apply(
            ts.map((t) => ({
              key: String(t.id),
              label: t.name,
              trailing: fmtDur(t.duration),
            })),
            ts,
          );
        } else if (view.kind === "artists") {
          const a = await api.artists();
          apply(
            a.map((x) => ({
              key: x.name,
              label: x.name,
              trailing: String(x.count),
              hasChildren: true,
            })),
          );
        } else if (view.kind === "artist-albums") {
          const a = await api.artistAlbums(view.artist);
          apply(
            a.map((x) => ({ key: x.name, label: x.name, hasChildren: true })),
          );
        } else if (view.kind === "albums") {
          const a = await api.albums();
          apply(
            a.map((x) => ({
              key: `${x.name}|${x.artist}`,
              label: x.name,
              trailing: x.artist,
              hasChildren: true,
            })),
          );
        } else if (view.kind === "album-tracks") {
          const ts = await api.albumTracks(view.album);
          apply(
            ts.map((t) => ({
              key: String(t.id),
              label: t.name,
              trailing: fmtDur(t.duration),
            })),
            ts,
          );
        } else if (view.kind === "songs") {
          const r = await api.songs(0, 500);
          apply(
            r.items.map((t) => ({
              key: String(t.id),
              label: t.name,
              trailing: t.artist,
            })),
            r.items,
          );
        } else if (view.kind === "genres") {
          const g = await api.genres();
          apply(
            g.map((x) => ({
              key: x.name,
              label: x.name,
              trailing: String(x.count),
              hasChildren: true,
            })),
          );
        } else if (view.kind === "genre-tracks") {
          const ts = await api.genreTracks(view.genre);
          apply(
            ts.map((t) => ({
              key: String(t.id),
              label: t.name,
              trailing: t.artist,
            })),
            ts,
          );
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewKey,
    view.kind === "root" ? `${player?.state}|${!!player?.name}` : "",
  ]);

  // Poll player state
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.state();
        if (alive) setPlayer(s);
      } catch {
        /* bridge offline */
      }
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);

  const onScroll = useCallback(
    (delta: number) =>
      dispatch({ type: "scroll", delta, max: items.length || 1 }),
    [items.length],
  );

  const onMenu = useCallback(() => dispatch({ type: "pop" }), []);
  const onPlayPause = useCallback(() => {
    api.playpause().catch(() => {});
  }, []);
  const playFromQueue = useCallback(
    async (delta: number) => {
      if (!queue || queue.tracks.length === 0) {
        if (delta > 0) await api.next().catch(() => {});
        else await api.previous().catch(() => {});
        return;
      }
      const nextIdx =
        (queue.index + delta + queue.tracks.length) % queue.tracks.length;
      const t = queue.tracks[nextIdx];
      const body: { trackId: string; playlistId?: string } = { trackId: t.id };
      if (queue.playlistId) body.playlistId = queue.playlistId;
      await api.play(body).catch(() => {});
      setQueue({ ...queue, index: nextIdx });
    },
    [queue],
  );
  const onNext = useCallback(() => {
    playFromQueue(1);
  }, [playFromQueue]);
  const onPrev = useCallback(() => {
    playFromQueue(-1);
  }, [playFromQueue]);

  const onSelect = useCallback(
    async (overrideIndex?: number) => {
      const i = overrideIndex ?? top.selected;
      if (overrideIndex !== undefined && overrideIndex !== top.selected) {
        dispatch({
          type: "scroll",
          delta: overrideIndex - top.selected,
          max: items.length || 1,
        });
      }
      if (view.kind === "root") {
        const item = items[i];
        if (!item) return;
        if (item.key === "music")
          dispatch({ type: "push", view: { kind: "music" } });
        else if (item.key === "now-playing")
          dispatch({ type: "push", view: { kind: "now-playing" } });
        else if (item.key === "shuffle") {
          await api.shuffle().catch(() => {});
          dispatch({ type: "push", view: { kind: "now-playing" } });
        }
      } else if (view.kind === "music") {
        const m = MUSIC_ITEMS[i];
        if (m) dispatch({ type: "push", view: m.view });
      } else if (view.kind === "playlists") {
        const item = items[i];
        if (item)
          dispatch({
            type: "push",
            view: { kind: "playlist", id: item.key, name: item.label },
          });
      } else if (view.kind === "artists") {
        const item = items[i];
        if (item)
          dispatch({
            type: "push",
            view: { kind: "artist-albums", artist: item.key },
          });
      } else if (view.kind === "artist-albums") {
        const item = items[i];
        if (item)
          dispatch({
            type: "push",
            view: { kind: "album-tracks", album: item.key },
          });
      } else if (view.kind === "albums") {
        const item = items[i];
        if (item) {
          const [name] = item.key.split("|");
          dispatch({
            type: "push",
            view: { kind: "album-tracks", album: name },
          });
        }
      } else if (view.kind === "genres") {
        const item = items[i];
        if (item)
          dispatch({
            type: "push",
            view: { kind: "genre-tracks", genre: item.key },
          });
      } else if (
        view.kind === "playlist" ||
        view.kind === "album-tracks" ||
        view.kind === "songs" ||
        view.kind === "genre-tracks"
      ) {
        const t = tracks[i];
        if (t) {
          const body: { trackId: string; playlistId?: string } = {
            trackId: t.id,
          };
          if (view.kind === "playlist") body.playlistId = view.id;
          await api.play(body).catch(() => {});
          setQueue({
            tracks,
            index: i,
            playlistId: view.kind === "playlist" ? view.id : undefined,
          });
          dispatch({ type: "push", view: { kind: "now-playing" } });
        }
      }
    },
    [items, top.selected, tracks, view],
  );

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onScroll(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onScroll(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect();
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        onMenu();
      } else if (e.key === " ") {
        e.preventDefault();
        onPlayPause();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onScroll, onSelect, onMenu, onPlayPause, onNext, onPrev]);

  const title =
    view.kind === "root"
      ? "iPod"
      : view.kind === "music"
        ? "Music"
        : view.kind === "playlists"
          ? "Playlists"
          : view.kind === "playlist"
            ? view.name
            : view.kind === "artists"
              ? "Artists"
              : view.kind === "artist-albums"
                ? view.artist
                : view.kind === "albums"
                  ? "Albums"
                  : view.kind === "album-tracks"
                    ? view.album
                    : view.kind === "songs"
                      ? "Songs"
                      : view.kind === "genres"
                        ? "Genres"
                        : view.kind === "genre-tracks"
                          ? view.genre
                          : "Now Playing";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div
        className="ipod-frame rounded-[44px] flex flex-col items-center"
        style={{ width: 420, padding: 26, paddingTop: 32 }}
      >
        <div
          className="ipod-screen rounded-lg overflow-hidden flex flex-col relative"
          style={{ width: 368, height: 300 }}
        >
          <div className="ipod-titlebar h-5 flex items-center justify-between px-2 text-[11px] font-semibold text-black/80">
            <span className="w-4">
              {player?.state === "playing"
                ? "▶"
                : player?.state === "paused"
                  ? "❚❚"
                  : ""}
            </span>
            <span className="truncate">{title}</span>
            <span className="w-5 flex justify-end">
              <span className="inline-block border border-black/60 rounded-sm px-0.75 py-px text-[8px] leading-none">
                ▮▮▮
              </span>
            </span>
          </div>
          {view.kind === "now-playing" && player ? (
            <NowPlaying state={player} />
          ) : (
            <MenuList
              items={itemsKey === viewKey ? items : []}
              selected={top.selected}
              onActivate={(i) => onSelect(i)}
            />
          )}
          {loading && (
            <div className="absolute right-2 top-6 text-[10px] text-gray-500">
              …
            </div>
          )}
        </div>
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
    </div>
  );
}
