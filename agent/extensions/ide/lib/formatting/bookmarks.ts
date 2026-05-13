import type { Theme } from "@earendil-works/pi-coding-agent";

export function formatBookmarkReference(
  theme: Theme,
  bookmark: string,
): string {
  return theme.inverse(theme.fg("accent", ` 󰃀 ${bookmark} `));
}

export function formatBookmarkLabels(
  theme: Theme,
  bookmarks: string[],
): string {
  if (bookmarks.length === 0) return "";
  return `${bookmarks
    .map((bookmark) => formatBookmarkReference(theme, bookmark))
    .join(" ")} `;
}
