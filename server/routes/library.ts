import { Router } from "express";
import { runScript, parseTsv, escapeAS } from "../applescript.js";
import { memo } from "../cache.js";

const r = Router();

const TTL = 60_000;

// Bulk-read each property as a list (one Apple Event per property), then zip
// in AppleScript's native list space. ~10x faster than iterating tracks.
const ALL_TRACKS_SCRIPT = `
tell application "Music"
  set _src to library playlist 1
  set _ids to persistent ID of every track of _src
  set _names to name of every track of _src
  set _artists to artist of every track of _src
  set _albums to album of every track of _src
  set _genres to genre of every track of _src
  set _durs to duration of every track of _src
  set _adds to date added of every track of _src
end tell
-- Locale-safe epoch (1970-01-01 00:00:00 local time): build from current date.
set _epoch to (current date)
set year of _epoch to 1970
set month of _epoch to 1
set day of _epoch to 1
set time of _epoch to 0
set _n to count of _ids
set _lines to {}
set AppleScript's text item delimiters to tab
repeat with i from 1 to _n
  set _sec to ((item i of _adds) - _epoch) as integer
  set end of _lines to ((item i of _ids) as text) & tab & (item i of _names) & tab & (item i of _artists) & tab & (item i of _albums) & tab & (item i of _genres) & tab & ((item i of _durs) as text) & tab & (_sec as text)
end repeat
set AppleScript's text item delimiters to linefeed
return _lines as text
`;

const SINGLE_PROP_SCRIPT = (prop: string) => `
tell application "Music"
  set _vals to ${prop} of every track of library playlist 1
end tell
set AppleScript's text item delimiters to linefeed
return _vals as text
`;

type TrackRow = [
  id: string,
  name: string,
  artist: string,
  album: string,
  genre: string,
  duration: string,
  addedAt: string,
];

type Track = {
  id: string;
  name: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  addedAt: number;
};

async function allTracks(): Promise<Track[]> {
  return memo("all_tracks", TTL, async () => {
    const out = await runScript(ALL_TRACKS_SCRIPT);
    return parseTsv<TrackRow>(out, 7).map(
      ([id, name, artist, album, genre, duration, addedAt]) => ({
        id,
        name,
        artist,
        album,
        genre,
        duration: Number(duration) || 0,
        addedAt: Number(addedAt) || 0,
      }),
    );
  });
}

r.get("/playlists", async (_req, res, next) => {
  try {
    const out = await memo("playlists", TTL, () =>
      runScript(`
set AppleScript's text item delimiters to tab
tell application "Music"
  set _pls to every user playlist
  set _lines to {}
  repeat with p in _pls
    try
      set _kind to "user"
      if smart of p then set _kind to "smart"
      set _coverId to ""
      try
        if (count of tracks of p) > 0 then set _coverId to (persistent ID of first track of p) as text
      end try
      set end of _lines to ((persistent ID of p) as text) & tab & (name of p) & tab & _kind & tab & ((count of tracks of p) as text) & tab & _coverId
    end try
  end repeat
end tell
set AppleScript's text item delimiters to linefeed
return _lines as text
`),
    );
    const playlists = parseTsv<[string, string, string, string, string]>(
      out,
      5,
    ).map(([id, name, kind, count, coverTrackId]) => ({
      id,
      name,
      kind,
      count: Number(count) || 0,
      coverTrackId: coverTrackId || undefined,
    }));
    res.json(playlists);
  } catch (e) {
    next(e);
  }
});

r.get("/playlists/:pid/tracks", async (req, res, next) => {
  try {
    const pid = escapeAS(req.params.pid);
    const out = await memo(`playlist:${pid}`, TTL, () =>
      runScript(`
tell application "Music"
  set _p to first user playlist whose persistent ID is "${pid}"
  set _ids to persistent ID of every track of _p
  set _names to name of every track of _p
  set _artists to artist of every track of _p
  set _albums to album of every track of _p
  set _durs to duration of every track of _p
end tell
set _n to count of _ids
set _lines to {}
set AppleScript's text item delimiters to tab
repeat with i from 1 to _n
  set end of _lines to ((item i of _ids) as text) & tab & (item i of _names) & tab & (item i of _artists) & tab & (item i of _albums) & tab & ((item i of _durs) as text)
end repeat
set AppleScript's text item delimiters to linefeed
return _lines as text
`),
    );
    const tracks = parseTsv<[string, string, string, string, string]>(
      out,
      5,
    ).map(([id, name, artist, album, duration]) => ({
      id,
      name,
      artist,
      album,
      duration: Number(duration) || 0,
    }));
    res.json(tracks);
  } catch (e) {
    next(e);
  }
});

r.get("/songs", async (req, res, next) => {
  try {
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const tracks = await allTracks();
    const sorted = [...tracks].sort((a, b) => b.addedAt - a.addedAt);
    res.json({
      total: sorted.length,
      items: sorted.slice(offset, offset + limit),
    });
  } catch (e) {
    next(e);
  }
});

async function distinctList(prop: string): Promise<Map<string, number>> {
  const out = await runScript(SINGLE_PROP_SCRIPT(prop));
  const map = new Map<string, number>();
  for (const v of out.split("\n")) {
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return map;
}

r.get("/artists", async (_req, res, next) => {
  try {
    const map = await memo("artists", TTL, () => distinctList("artist"));
    const artists = [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(artists);
  } catch (e) {
    next(e);
  }
});

r.get("/artists/:name/albums", async (req, res, next) => {
  try {
    const name = req.params.name;
    const tracks = await allTracks();
    const set = new Set<string>();
    for (const t of tracks) if (t.artist === name && t.album) set.add(t.album);
    const albums = [...set]
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ name: n, artist: name }));
    res.json(albums);
  } catch (e) {
    next(e);
  }
});

r.get("/albums", async (_req, res, next) => {
  try {
    const tracks = await allTracks();
    const map = new Map<string, { name: string; artist: string }>();
    for (const t of tracks) {
      if (!t.album) continue;
      const key = `${t.album}|${t.artist}`;
      if (!map.has(key)) map.set(key, { name: t.album, artist: t.artist });
    }
    res.json([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) {
    next(e);
  }
});

r.get("/albums/:name/tracks", async (req, res, next) => {
  try {
    const name = req.params.name;
    const tracks = await allTracks();
    res.json(tracks.filter((t) => t.album === name));
  } catch (e) {
    next(e);
  }
});

r.get("/genres", async (_req, res, next) => {
  try {
    const map = await memo("genres", TTL, () => distinctList("genre"));
    res.json(
      [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  } catch (e) {
    next(e);
  }
});

r.get("/genres/:name/tracks", async (req, res, next) => {
  try {
    const name = req.params.name;
    const tracks = await allTracks();
    res.json(tracks.filter((t) => t.genre === name));
  } catch (e) {
    next(e);
  }
});

export default r;
