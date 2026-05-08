import type { Track } from "./api";
import type { MenuItem } from "../ipod/MenuList";

export type { MenuItem, Track };

export type View =
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

export type Frame = {
  view: View;
  selected: number;
  items: MenuItem[];
  tracks: Track[];
  loaded: boolean;
};

export type NavState = { stack: Frame[] };

export type NavAction =
  | { type: "push"; view: View }
  | { type: "pop" }
  | { type: "scroll"; delta: number }
  | { type: "set-data"; viewKey: string; items: MenuItem[]; tracks: Track[] };
