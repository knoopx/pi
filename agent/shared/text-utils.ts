import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

export function ensureWidth(text: string, width: number): string {
  const current = visibleWidth(text);
  if (current >= width) return truncateToWidth(text, width, "", true);
  // Reset ANSI before padding to prevent style leakage into trailing spaces
  return text + "\x1b[0m" + " ".repeat(width - current);
}

export function padRight(text: string, width: number): string {
  const current = visibleWidth(text);
  if (current >= width) return truncateToWidth(text, width, "", true);
  return text + "\x1b[0m" + " ".repeat(width - current);
}

export function padLeft(text: string, width: number): string {
  const current = visibleWidth(text);
  if (current >= width) return truncateToWidth(text, width, "", true);
  return " ".repeat(width - current) + text;
}

export function buildHelpText(
  ...items: (string | false | null | undefined)[]
): string {
  return items.filter(Boolean).join(" • ");
}

export function applySelectionBackground(
  styledText: string,
  width: number,
  theme: Theme,
): string {
  const pad = Math.max(0, width - visibleWidth(styledText));
  return theme.bg("selectedBg", styledText + " ".repeat(pad));
}

export function renderEmptyRow(
  message: string,
  width: number,
  theme: Theme,
): string {
  const text = theme.fg("dim", ` ${message}`);
  return ensureWidth(text, width);
}
