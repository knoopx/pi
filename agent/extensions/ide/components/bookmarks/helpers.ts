import type { BookmarkEntry } from "./types";
import { Key } from "@mariozechner/pi-tui";
import type { BookmarkFilterMode } from "../../lib/types";

const BOOKMARK_FILTER_MODES = [
  "all",
  "bookmarks",
  "descriptions",
  "authors",
] as const;
import type { Theme } from "@mariozechner/pi-coding-agent";
import { formatBookmarkReference } from "../../lib/changes-formatting";

function parseBookmark(bookmark: string): { name: string; remote: string } {
  const atIndex = bookmark.lastIndexOf("@");
  if (atIndex === -1) return { name: bookmark, remote: "" };
  return {
    name: bookmark.slice(0, atIndex),
    remote: bookmark.slice(atIndex + 1),
  };
}

export function groupBookmarksByChange(
  entries: {
    bookmark: string;
    changeId: string;
    description: string;
    author: string;
  }[],
): BookmarkEntry[] {
  const byChange = new Map<
    string,
    { bookmarks: string[]; description: string; author: string }
  >();

  for (const entry of entries) {
    const existing = byChange.get(entry.changeId);
    if (existing) existing.bookmarks.push(entry.bookmark);
    else {
      byChange.set(entry.changeId, {
        bookmarks: [entry.bookmark],
        description: entry.description,
        author: entry.author,
      });
    }
  }

  return Array.from(byChange.entries()).map(
    ([changeId, { bookmarks, description, author }]) => {
      // Deduplicate by base name (prefer showing each name once)
      const seenNames = new Set<string>();
      const displayNames: string[] = [];
      for (const b of bookmarks) {
        const { name } = parseBookmark(b);
        if (!seenNames.has(name)) {
          seenNames.add(name);
          displayNames.push(name);
        }
      }
      return {
        id: changeId,
        label: displayNames.join(" "),
        bookmarks,
        changeId,
        description: description || "(no description)",
        author,
        displayNames,
      };
    },
  );
}

export function createToggleFilterBinding(filterRef: {
  value: BookmarkFilterMode;
}) {
  return {
    key: Key.ctrl("/"),
    handler() {
      const currentIndex = BOOKMARK_FILTER_MODES.indexOf(filterRef.value);
      const nextIndex = (currentIndex + 1) % BOOKMARK_FILTER_MODES.length;
      filterRef.value = BOOKMARK_FILTER_MODES[nextIndex];
    },
  };
}

export function formatBookmarkLine(
  item: BookmarkEntry,
  width: number,
  theme: Theme,
): string {
  const bookmarkLabels = item.displayNames
    .map((name) => formatBookmarkReference(theme, name))
    .join(" ");
  const sep = " · ";
  const author = item.author || "";
  const bookmarkLen = item.displayNames.reduce(
    (sum, n) => sum + n.length + 5,
    0,
  );
  const fixedLen = bookmarkLen + sep.length + author.length + sep.length;
  const maxDescLen = Math.max(10, width - fixedLen);
  const desc =
    item.description.length > maxDescLen
      ? `${item.description.slice(0, maxDescLen - 1)}…`
      : item.description;

  const styledSep = theme.fg("dim", sep);
  const styledDesc = theme.fg("dim", desc);
  const styledAuthor = author ? theme.fg("dim", author) : "";
  const parts = [bookmarkLabels, styledDesc, styledAuthor].filter(Boolean);
  return parts.join(styledSep);
}

export function filterBookmarksByMode(
  items: BookmarkEntry[],
  query: string,
  mode: BookmarkFilterMode,
): BookmarkEntry[] {
  const lowerQuery = query.toLowerCase();
  if (mode === "bookmarks")
    return items.filter((item) =>
      item.bookmarks.some((b) => b.toLowerCase().includes(lowerQuery)),
    );
  if (mode === "descriptions")
    return items.filter((item) =>
      item.description.toLowerCase().includes(lowerQuery),
    );
  if (mode === "authors")
    return items.filter((item) =>
      item.author.toLowerCase().includes(lowerQuery),
    );
  return items.filter(
    (item) =>
      item.bookmarks.some((b) => b.toLowerCase().includes(lowerQuery)) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.author.toLowerCase().includes(lowerQuery),
  );
}
