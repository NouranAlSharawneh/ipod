import { Router } from "express";
import { runScript, escapeAS } from "../applescript.js";

const r = Router();

const STATE_SCRIPT = `
set AppleScript's text item delimiters to tab
tell application "Music"
  set _state to (player state as text)
  if _state is "stopped" then
    return "stopped" & tab & "" & tab & "" & tab & "" & tab & "0" & tab & "0" & tab & "0"
  end if
  try
    set t to current track
    set _name to name of t
    set _artist to artist of t
    set _album to album of t
    set _dur to (duration of t) as text
    set _pos to (player position) as text
    set _id to (persistent ID of t) as text
    return _state & tab & _name & tab & _artist & tab & _album & tab & _dur & tab & _pos & tab & _id
  on error
    return _state & tab & "" & tab & "" & tab & "" & tab & "0" & tab & "0" & tab & "0"
  end try
end tell
`;

r.get("/state", async (_req, res, next) => {
  try {
    const out = await runScript(STATE_SCRIPT);
    const [state, name, artist, album, duration, position, id] =
      out.split("\t");
    res.json({
      state,
      name,
      artist,
      album,
      duration: Number(duration) || 0,
      position: Number(position) || 0,
      id: id || "",
    });
  } catch (e) {
    next(e);
  }
});

r.post("/play", async (req, res, next) => {
  try {
    const { trackId, playlistId } = req.body ?? {};
    let script: string;
    const tid = trackId ? escapeAS(String(trackId)) : "";
    const pid = playlistId ? escapeAS(String(playlistId)) : "";
    if (tid && pid) {
      script = `tell application "Music" to play (some track of (some user playlist whose persistent ID is "${pid}") whose persistent ID is "${tid}")`;
    } else if (tid) {
      script = `
tell application "Music"
  try
    play (some track of library playlist 1 whose persistent ID is "${tid}")
  on error
    -- fall back: search all user playlists for a match
    repeat with p in (every user playlist)
      try
        play (some track of p whose persistent ID is "${tid}")
        return
      end try
    end repeat
    error "track not found"
  end try
end tell`;
    } else if (pid) {
      script = `tell application "Music" to play (some user playlist whose persistent ID is "${pid}")`;
    } else {
      script = `tell application "Music" to play`;
    }
    await runScript(script);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post("/pause", async (_req, res, next) => {
  try {
    await runScript(`tell application "Music" to pause`);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post("/playpause", async (_req, res, next) => {
  try {
    await runScript(`tell application "Music" to playpause`);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post("/next", async (_req, res, next) => {
  try {
    await runScript(`tell application "Music" to next track`);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post("/previous", async (_req, res, next) => {
  try {
    await runScript(`tell application "Music" to back track`);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post("/seek", async (req, res, next) => {
  try {
    const pos = Number(req.body?.position) || 0;
    await runScript(
      `tell application "Music" to set player position to ${pos}`,
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post("/shuffle", async (_req, res, next) => {
  try {
    await runScript(`
tell application "Music"
  set shuffle enabled to true
  play library playlist 1
end tell
`);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
