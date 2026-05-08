import { useSyncExternalStore } from "react";
import { api, type Track } from "./api";

const FIRST_PAGE = 50;
const CHUNK = 200;

type SongsState = {
  items: Track[];
  total: number;
  loaded: boolean;
  error?: string;
};

let state: SongsState = { items: [], total: 0, loaded: false };
const listeners = new Set<() => void>();
let prefetchPromise: Promise<void> | null = null;

function setState(next: SongsState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function prefetchSongs(): Promise<void> {
  if (state.loaded) return Promise.resolve();
  if (prefetchPromise) return prefetchPromise;

  prefetchPromise = (async () => {
    try {
      const first = await api.songs(0, FIRST_PAGE);
      setState({
        items: first.items,
        total: first.total,
        loaded: first.items.length >= first.total,
      });

      let offset = first.items.length;
      while (offset < first.total) {
        const page = await api.songs(offset, CHUNK);
        offset += page.items.length;
        setState({
          items: [...state.items, ...page.items],
          total: page.total,
          loaded: offset >= page.total,
        });
        if (page.items.length === 0) break;
      }
    } catch (e) {
      setState({ ...state, error: String(e) });
    }
  })();

  return prefetchPromise;
}

function getSnapshot(): SongsState {
  return state;
}

export function useSongs(): SongsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
