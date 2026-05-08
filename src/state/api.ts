export type Track = {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
};

export type Playlist = {
  id: string;
  name: string;
  kind: string;
  count: number;
};
export type Artist = { name: string; count: number };
export type Album = { name: string; artist: string };
export type Genre = { name: string; count: number };

export type PlayerState = {
  state: "playing" | "paused" | "stopped" | "fast forwarding" | "rewinding";
  name: string;
  artist: string;
  album: string;
  duration: number;
  position: number;
  id: string;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

const DEFAULT_TTL = 60_000;
type Entry<T> = { value: T; expires: number };
const cache = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

async function getCached<T>(path: string, ttl = DEFAULT_TTL): Promise<T> {
  const now = Date.now();
  const hit = cache.get(path) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;
  const existing = inflight.get(path) as Promise<T> | undefined;
  if (existing) return existing;
  const p = (async () => {
    try {
      const value = await get<T>(path);
      cache.set(path, { value, expires: Date.now() + ttl });
      return value;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}

function invalidate(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function invalidatePlayer<T>(p: Promise<T>): Promise<T> {
  return p.then((v) => {
    invalidate("/api/player");
    return v;
  });
}

export const api = {
  playlists: () => getCached<Playlist[]>("/api/library/playlists"),
  playlistTracks: (id: string) =>
    getCached<Track[]>(`/api/library/playlists/${encodeURIComponent(id)}/tracks`),
  artists: () => getCached<Artist[]>("/api/library/artists"),
  artistAlbums: (name: string) =>
    getCached<Album[]>(`/api/library/artists/${encodeURIComponent(name)}/albums`),
  albums: () => getCached<Album[]>("/api/library/albums"),
  albumTracks: (name: string) =>
    getCached<Track[]>(`/api/library/albums/${encodeURIComponent(name)}/tracks`),
  songs: (offset = 0, limit = 500) =>
    getCached<{ total: number; items: Track[] }>(
      `/api/library/songs?offset=${offset}&limit=${limit}`,
    ),
  genres: () => getCached<Genre[]>("/api/library/genres"),
  genreTracks: (name: string) =>
    getCached<Track[]>(`/api/library/genres/${encodeURIComponent(name)}/tracks`),
  state: () => get<PlayerState>("/api/player/state"),
  play: (body?: { trackId?: string; playlistId?: string }) =>
    invalidatePlayer(post<{ ok: true }>("/api/player/play", body)),
  pause: () => invalidatePlayer(post<{ ok: true }>("/api/player/pause")),
  playpause: () => invalidatePlayer(post<{ ok: true }>("/api/player/playpause")),
  next: () => invalidatePlayer(post<{ ok: true }>("/api/player/next")),
  previous: () => invalidatePlayer(post<{ ok: true }>("/api/player/previous")),
  seek: (position: number) =>
    invalidatePlayer(post<{ ok: true }>("/api/player/seek", { position })),
  shuffle: () => invalidatePlayer(post<{ ok: true }>("/api/player/shuffle")),
  artworkUrl: (id: string) => `/api/artwork/${id}`,
  invalidate,
};
