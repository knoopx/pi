import type { Theme } from "@earendil-works/pi-coding-agent";
import stringWidth from "string-width";
import { ensureWidth } from "../../../../shared/format/ansi-text";

export function applySelectionBackground(
  styledText: string,
  width: number,
  theme: Theme,
): string {
  const visibleLen = stringWidth(styledText);
  const padding = Math.max(0, width - visibleLen);
  return theme.bg("selectedBg", styledText + " ".repeat(padding));
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
