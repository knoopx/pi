import { relative } from "node:path";

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function strip(s: string): string {
  return s.replace(ANSI_RE, "");
}

export function termW(): number {
  const raw =
    process.stdout?.columns ??
    Number.parseInt(process.env.COLUMNS ?? "", 10) ??
    200;
  return Math.max(80, Math.min(raw - 4, 210));
}

export function shortPath(cwd: string, home: string, p: string): string {
  if (!p) return "";
  const r = relative(cwd, p);
  if (!r.startsWith("..") && !r.startsWith("/")) return r;
  return p.replace(home, "~");
}
