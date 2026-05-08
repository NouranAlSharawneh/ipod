import { Router } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const r = Router();

r.get("/battery", async (_req, res, next) => {
  try {
    const { stdout } = await execFileP("pmset", ["-g", "batt"]);
    const pctMatch = stdout.match(/(\d+)%/);
    const percent = pctMatch ? Number(pctMatch[1]) : 100;
    const charging = /charging|charged|AC Power/i.test(stdout) && !/discharging/i.test(stdout);
    res.json({ percent, charging });
  } catch (e) {
    next(e);
  }
});

export default r;
