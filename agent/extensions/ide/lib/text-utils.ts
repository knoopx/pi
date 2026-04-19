import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";
import type { Theme } from "@mariozechner/pi-coding-agent";

const OSC_FULL_PATTERN =
  /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\|\u001b(?=\[))?/g;
const OSC_BARE_URL_PATTERN = /\]8;;[^\u0007\u001b\]\s]*(?=\]8;;)/g;
const OSC_BARE_MARKER_PATTERN = /\]8;;/g;

function stripOscSequences(text: string): string {
  return text
    .replace(OSC_FULL_PATTERN, "")
    .replace(OSC_BARE_URL_PATTERN, "")
    .replace(OSC_BARE_MARKER_PATTERN, "");
}


export function truncateAnsi(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  if (stringWidth(cleaned) <= width) return cleaned;
  return sliceAnsi(cleaned, 0, width);
}


export function pad(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  const len = stringWidth(cleaned);
  if (len >= width) return sliceAnsi(cleaned, 0, width);
  // Always reset before padding to prevent ANSI style leakage into trailing spaces
  return cleaned + "\x1b[0m" + " ".repeat(width - len);
}


export function ensureWidth(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  const currentWidth = stringWidth(cleaned);
  if (currentWidth === width) return cleaned;
  if (currentWidth > width) return sliceAnsi(cleaned, 0, width);
  // Always reset before padding to prevent ANSI style leakage into trailing spaces
  return cleaned + "\x1b[0m" + " ".repeat(width - currentWidth);
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
  const visibleLen = stringWidth(styledText);
  const pad = Math.max(0, width - visibleLen);
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


export function renderEmptyRowWithReset(
  message: string,
  width: number,
  theme: Theme,
): string {
  return "\x1b[0m" + renderEmptyRow(message, width, theme);
}


export function getVisibleItems<T>(
  items: T[],
  selectedIndex: number,
  height: number,
): Array<{ item: T; index: number }> {
  let startIdx = 0;
  if (selectedIndex >= height) {
    startIdx = selectedIndex - height + 1;
  }

  const visible: Array<{ item: T; index: number }> = [];
  for (let i = 0; i < height && startIdx + i < items.length; i++) {
    const idx = startIdx + i;
    visible.push({ item: items[idx], index: idx });
  }
  return visible;
}
