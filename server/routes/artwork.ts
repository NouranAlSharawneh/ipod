import { Router } from "express";
import { runScript } from "../applescript.js";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const r = Router();

// Streamed Apple Music tracks expose 0 artworks via AppleScript, so we fall
// back to the iTunes Search API (artist + album) and upgrade the URL to 600px.
async function fetchITunesArtwork(
  artist: string,
  album: string,
): Promise<{ buf: Buffer; type: string } | null> {
  const term = `${artist} ${album}`.trim();
  if (!term) return null;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term,
  )}&entity=album&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { artworkUrl100?: string }[] };
  const art = data.results?.[0]?.artworkUrl100;
  if (!art) return null;
  const big = art.replace("100x100bb", "600x600bb");
  const imgRes = await fetch(big);
  if (!imgRes.ok) return null;
  const buf = Buffer.from(await imgRes.arrayBuffer());
  return { buf, type: imgRes.headers.get("content-type") || "image/jpeg" };
}

r.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!id || !/^[A-Za-z0-9]+$/.test(id)) return res.status(400).end();
    const path = join(tmpdir(), `ipod_art_${id}.dat`);

    // First, ask Music for the track's artist/album and try to grab its
    // embedded artwork. For streamed tracks, artwork count is 0 — we'll fall
    // back to iTunes Search using the metadata we just fetched.
    const script = `
tell application "Music"
  set t to missing value
  try
    if persistent ID of current track is "${id}" then set t to current track
  end try
  if t is missing value then
    try
      set t to some track of library playlist 1 whose persistent ID is "${id}"
    end try
  end if
  if t is missing value then
    repeat with p in (every user playlist)
      try
        set t to some track of p whose persistent ID is "${id}"
        exit repeat
      end try
    end repeat
  end if
  if t is missing value then return "NONE\\t\\t"
  set _artist to artist of t
  set _album to album of t
  set _hasArt to false
  try
    if (count of artworks of t) > 0 then
      set _art to artwork 1 of t
      set _data to data of _art
      try
        set _f to open for access (POSIX file "${path}") with write permission
        set eof of _f to 0
        write _data to _f
        close access _f
        set _hasArt to true
      on error
        try
          close access (POSIX file "${path}")
        end try
      end try
    end if
  end try
  if _hasArt then
    return "LOCAL\\t" & _artist & "\\t" & _album
  else
    return "REMOTE\\t" & _artist & "\\t" & _album
  end if
end tell
`;
    const out = await runScript(script);
    const [status, artist = "", album = ""] = out.split("\t");

    if (status === "LOCAL" && existsSync(path)) {
      const buf = readFileSync(path);
      const sig = buf.subarray(0, 4);
      let type = "application/octet-stream";
      if (sig[0] === 0xff && sig[1] === 0xd8) type = "image/jpeg";
      else if (
        sig[0] === 0x89 &&
        sig[1] === 0x50 &&
        sig[2] === 0x4e &&
        sig[3] === 0x47
      )
        type = "image/png";
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.end(buf);
    }

    if (status === "REMOTE") {
      const remote = await fetchITunesArtwork(artist, album);
      if (remote) {
        res.setHeader("Content-Type", remote.type);
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.end(remote.buf);
      }
    }

    return res.status(404).end();
  } catch (e) {
    next(e);
  }
});
export default r;
