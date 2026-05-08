import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export async function runScript(src: string): Promise<string> {
  const { stdout } = await execFileP("osascript", ["-e", src], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.replace(/\n$/, "");
}

export function parseTsv<T extends string[]>(out: string, fields: number): T[] {
  if (!out) return [];
  return out
    .split("\n")
    .map((line) => line.split("\t") as T)
    .filter((cols) => cols.length === fields);
}

export function escapeAS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
