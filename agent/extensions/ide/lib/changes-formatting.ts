import type { Theme } from "@mariozechner/pi-coding-agent";

export function formatBookmarkReference(
  theme: Theme,
  bookmark: string,
): string {
  return theme.inverse(theme.fg("accent", ` 󰃀 ${bookmark} `));
}

function formatBookmarkLabels(theme: Theme, bookmarks: string[]): string {
  if (bookmarks.length === 0) return "";
  return `${bookmarks
    .map((bookmark) => formatBookmarkReference(theme, bookmark))
    .join(" ")} `;
}


export function getChangeIcon(
  isWorkingCopy: boolean,
  isEmpty: boolean,
): string {
  if (isWorkingCopy) return isEmpty ? "◎" : "◉";
  return isEmpty ? "○" : "◆";
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
  const description = opts.isMoving
    ? theme.fg("warning", theme.bold(opts.description))
    : opts.isFocused
      ? theme.fg("accent", theme.bold(opts.description))
      : opts.isImmutable
        ? theme.fg("dim", opts.description)
        : opts.description;
  const leftText = `${selectMarker}${moveIndicator}${bookmarkLabel}${description}`;

  return { leftText, rightText: "" };
}


export function visibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, "").length;
}
