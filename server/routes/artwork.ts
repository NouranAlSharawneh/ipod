import { Router } from "express";
import { runScript } from "../applescript.js";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const r = Router();

r.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!id || !/^[A-Za-z0-9]+$/.test(id)) return res.status(400).end();
    const path = join(tmpdir(), `ipod_art_${id}.dat`);
    const script = `
tell application "Music"
  set t to missing value
  try
    set t to some track of library playlist 1 whose persistent ID is "${id}"
  end try
  if t is missing value then
    repeat with p in (every user playlist)
      try
        set t to some track of p whose persistent ID is "${id}"
        exit repeat
      end try
    end repeat
  end if
  if t is missing value then return "NONE"
  try
    set _art to artwork 1 of t
    set _data to data of _art
  on error
    return "NONE"
  end try
end tell
try
  set _f to open for access (POSIX file "${path}") with write permission
  set eof of _f to 0
  write _data to _f
  close access _f
  return "OK"
on error errMsg
  try
    close access (POSIX file "${path}")
  end try
  return "ERR:" & errMsg
end try
`;
    const out = await runScript(script);
    if (!out.startsWith("OK") || !existsSync(path)) {
      return res.status(404).end();
    }
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
    res.end(buf);
  } catch (e) {
    next(e);
  }
});

export default r;
