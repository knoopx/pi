import type { Theme } from "@earendil-works/pi-coding-agent";
import { formatBookmarkLabels } from "./bookmarks";

export function getChangeIcon(
  isWorkingCopy: boolean,
  isEmpty: boolean,
): string {
  if (isWorkingCopy) return isEmpty ? "◎" : "◉";
  return isEmpty ? "○" : "◆";
}

function styleDescription(
  theme: Theme,
  description: string,
  isMoving: boolean | undefined,
  isFocused: boolean | undefined,
  isImmutable: boolean,
): string {
  if (isMoving) return theme.fg("warning", theme.bold(description));
  if (isFocused) return theme.fg("accent", theme.bold(description));
  if (isImmutable) return theme.fg("dim", description);
  return description;
}

export function formatChangeRow(
  theme: Theme,
  opts: {
    isImmutable: boolean;
    isSelected: boolean;
    isFocused?: boolean;
    isMoving?: boolean;
    bookmarks: string[];
    description: string;
  },
): { leftText: string; rightText: string } {
  const selectMarker = opts.isSelected ? theme.fg("accent", "✓ ") : "";
  const bookmarkLabel = opts.isImmutable
    ? theme.fg("dim", formatBookmarkLabels(theme, opts.bookmarks))
    : formatBookmarkLabels(theme, opts.bookmarks);
  const moveIndicator = opts.isMoving ? theme.fg("warning", "↕ ") : "";
  const description = styleDescription(
    theme,
    opts.description,
    opts.isMoving,
    opts.isFocused,
    opts.isImmutable,
  );
  const leftText = `${selectMarker}${moveIndicator}${bookmarkLabel}${description}`;

  return { leftText, rightText: "" };
}

export function visibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, "").length;
}
