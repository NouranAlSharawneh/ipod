import { api, type PlayerState } from "./api";
import type { MenuItem, Track, View } from "./types";

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

// Tracks may appear multiple times in a single playlist (same persistent ID),
// so prefix the key with the row index to keep React keys unique.
const trackItem = (i: number, t: Track, trailing: string): MenuItem => ({
  key: `${i}-${t.id}`,
  label: t.name,
  trailing,
});

export const MUSIC_ITEMS: { label: string; view: View }[] = [
  { label: "Playlists", view: { kind: "playlists" } },
  { label: "Artists", view: { kind: "artists" } },
  { label: "Albums", view: { kind: "albums" } },
  { label: "Songs", view: { kind: "songs" } },
  { label: "Genres", view: { kind: "genres" } },
];

export async function loadView(
  view: View,
  player: PlayerState | null,
): Promise<{ items: MenuItem[]; tracks: Track[] }> {
  switch (view.kind) {
    case "root": {
      const showNP = !!player && player.state !== "stopped" && !!player.name;
      const items: MenuItem[] = [
        { key: "music", label: "Music", hasChildren: true },
      ];
      if (showNP)
        items.push({
          key: "now-playing",
          label: "Now Playing",
          hasChildren: true,
        });
      items.push({ key: "shuffle", label: "Shuffle Songs" });
      return { items, tracks: [] };
    }

    case "music":
      return {
        items: MUSIC_ITEMS.map((m) => ({
          key: m.label,
          label: m.label,
          hasChildren: true,
        })),
        tracks: [],
      };

    case "playlists": {
      const pls = await api.playlists();
      return {
        items: pls.map((p) => ({
          key: p.id,
          label: p.name,
          trailing: String(p.count),
          hasChildren: true,
        })),
        tracks: [],
      };
    }

    case "playlist": {
      const ts = await api.playlistTracks(view.id);
      return {
        items: ts.map((t, i) => trackItem(i, t, fmtDur(t.duration))),
        tracks: ts,
      };
    }

    case "artists": {
      const a = await api.artists();
      return {
        items: a.map((x) => ({
          key: x.name,
          label: x.name,
          trailing: String(x.count),
          hasChildren: true,
        })),
        tracks: [],
      };
    }

    case "artist-albums": {
      const a = await api.artistAlbums(view.artist);
      return {
        items: a.map((x) => ({
          key: x.name,
          label: x.name,
          hasChildren: true,
        })),
        tracks: [],
      };
    }

    case "albums": {
      const a = await api.albums();
      return {
        items: a.map((x) => ({
          key: `${x.name}|${x.artist}`,
          label: x.name,
          trailing: x.artist,
          hasChildren: true,
        })),
        tracks: [],
      };
    }

    case "album-tracks": {
      const ts = await api.albumTracks(view.album);
      return {
        items: ts.map((t, i) => trackItem(i, t, fmtDur(t.duration))),
        tracks: ts,
      };
    }

    case "songs": {
      const r = await api.songs(0, 500);
      return {
        items: r.items.map((t, i) => trackItem(i, t, t.artist)),
        tracks: r.items,
      };
    }

    case "genres": {
      const g = await api.genres();
      return {
        items: g.map((x) => ({
          key: x.name,
          label: x.name,
          trailing: String(x.count),
          hasChildren: true,
        })),
        tracks: [],
      };
    }

    case "genre-tracks": {
      const ts = await api.genreTracks(view.genre);
      return {
        items: ts.map((t, i) => trackItem(i, t, t.artist)),
        tracks: ts,
      };
    }

    default:
      return { items: [], tracks: [] };
  }
}

export function titleFor(view: View): string {
  switch (view.kind) {
    case "root":
      return "iPod";
    case "music":
      return "Music";
    case "playlists":
      return "Playlists";
    case "playlist":
      return view.name;
    case "artists":
      return "Artists";
    case "artist-albums":
      return view.artist;
    case "albums":
      return "Albums";
    case "album-tracks":
      return view.album;
    case "songs":
      return "Songs";
    case "genres":
      return "Genres";
    case "genre-tracks":
      return view.genre;
    case "now-playing":
      return "Now Playing";
  }
}
