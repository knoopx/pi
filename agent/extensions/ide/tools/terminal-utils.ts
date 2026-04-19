import { relative } from "node:path";

export function termW(): number {
  const raw = resolveTerminalWidth();
  return clampTerminalWidth(raw);
}

function resolveTerminalWidth(): number {
  const stdoutCols = process.stdout?.columns;
  if (stdoutCols) return stdoutCols;
  return parseEnvColumns() ?? 200;
}

function parseEnvColumns(): number | null {
  const raw = process.env.COLUMNS ?? "";
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function clampTerminalWidth(raw: number): number {
  return Math.max(80, Math.min(raw - 4, 210));
}

export function shortPath(cwd: string, home: string, p: string): string {
  if (!p) return "";
  const r = relative(cwd, p);
  if (!r.startsWith("..") && !r.startsWith("/")) return r;
  return p.replace(home, "~");
}
