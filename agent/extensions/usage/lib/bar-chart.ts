import type { Theme } from "@earendil-works/pi-coding-agent";

function formatBarRow(
  name: string,
  count: number,
  maxNameLen: number,
  maxCount: number,
  total: number,
  theme: Theme,
): string {
  const th = theme;
  const pct = ((count / total) * 100).toFixed(1);
  const barLen = Math.round((count / maxCount) * 30);
  const bar = "█".repeat(barLen);
  return `  ${name.padEnd(maxNameLen)}  ${String(count).padStart(6)}  ${th.fg("dim", `(${pct.padStart(5)}%)`)}  ${th.fg("accent", bar)}`;
}

export { formatBarRow };
