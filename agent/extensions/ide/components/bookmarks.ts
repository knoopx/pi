import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerItem,
  type ListPickerComponent,
  type ListPickerAction,
} from "./list-picker";
import { formatBookmarkReference } from "./changes/formatting";

import {
  forgetBookmark,
  getRawDiff,
  listBookmarksByChange,
  notifyMutation,
} from "../jj";
import { getTheme, renderDiffWithShiki } from "../tools/diff";

interface BookmarkEntry extends ListPickerItem {
  bookmarks: string[];
  changeId: string;
  description: string;
  author: string;
  /** Deduplicated bookmark base names for display */
  displayNames: string[];
}

/**
 * Extract base bookmark name (before @) and remote suffix
 */
function parseBookmark(bookmark: string): { name: string; remote: string } {
  const atIndex = bookmark.lastIndexOf("@");
  if (atIndex === -1) return { name: bookmark, remote: "" };
  return {
    name: bookmark.slice(0, atIndex),
    remote: bookmark.slice(atIndex + 1),
  };
}

function groupBookmarksByChange(
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

import { ACTION_KEYS, createKeyboardHandler } from "../keyboard";
import type { BookmarkFilterMode } from "../types";

const BOOKMARK_FILTER_MODES = [
  "all",
  "bookmarks",
  "descriptions",
  "authors",
] as const;

function filterBookmarks(
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

function createToggleFilterBinding(filterRef: { value: BookmarkFilterMode }) {
  return {
    key: Key.ctrl("/"),
    handler() {
      const currentIndex = BOOKMARK_FILTER_MODES.indexOf(filterRef.value);
      const nextIndex = (currentIndex + 1) % BOOKMARK_FILTER_MODES.length;
      filterRef.value = BOOKMARK_FILTER_MODES[nextIndex];
    },
  };
}

function formatBookmarkLine(
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

export function createBookmarksComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: BookmarkEntry | null) => void,
  cwd: string,
  onInsert?: (text: string) => void,
): ListPickerComponent {
  // Picker reference for reload in actions
  let pickerRef: ListPickerComponent | null = null;
  // Current filter mode (defaults to all)
  const filterModeRef = { value: "all" as BookmarkFilterMode };

  const actions: ListPickerAction<BookmarkEntry>[] = [
    {
      key: Key.ctrl("n"),
      label: "new",
      async handler(item) {
        const result = await pi.exec("jj", ["new", "-r", item.changeId], {
          cwd,
        });
        if (result.code === 0) {
          const msg = `Started work from change ${item.changeId.slice(0, 8)} (${item.displayNames[0] || item.changeId})`;
          notifyMutation(pi, msg, result.stderr || result.stdout);
          done(null);
        } else {
          notifyMutation(
            pi,
            "error",
            result.stderr ||
              `Failed to start work from change ${item.changeId.slice(0, 8)}`,
          );
        }
      },
    },
    {
      key: ACTION_KEYS.delete,
      label: "delete",
      async handler(item) {
        const forgetOutputs: string[] = [];
        for (const bookmark of item.bookmarks) {
          forgetOutputs.push(await forgetBookmark(pi, cwd, bookmark));
        }
        const msg = `Forgot bookmarks (${item.bookmarks.length}): ${item.bookmarks.join(", ")}`;
        notifyMutation(pi, msg, forgetOutputs.join("\n"));
        await pickerRef?.reload();
      },
    },
    {
      key: Key.ctrl("g"),
      label: "fetch",
      async handler() {
        const result = await pi.exec("jj", ["git", "fetch"], { cwd });
        if (result.code === 0) {
          const msg = "Fetched all bookmarks from all remotes";
          notifyMutation(pi, msg, result.stderr || result.stdout);
        } else {
          notifyMutation(pi, "error", result.stderr || "Fetch failed");
        }
        await pickerRef?.reload();
      },
    },
    {
      key: Key.ctrl("p"),
      label: "push",
      async handler() {
        const result = await pi.exec("jj", ["git", "push", "--all"], { cwd });
        if (result.code === 0) {
          const msg = "Pushed all local bookmarks to remote";
          notifyMutation(pi, msg, result.stderr || result.stdout);
        } else {
          notifyMutation(pi, "error", result.stderr || "Push failed");
        }
        await pickerRef?.reload();
      },
    },
    {
      key: Key.ctrl("i"),
      label: "insert",
      handler(item) {
        if (onInsert) {
          onInsert(item.bookmarks[0] || item.changeId);
          done(null);
        }
      },
    },
  ];

  const picker = createListPicker<BookmarkEntry>(
    pi,
    tui,
    theme,
    keybindings,
    done,
    "",
    {
      title: "Bookmarks",
      previewTitle: (item) =>
        item.displayNames[0] ?? item.changeId.slice(0, 12),
      actions,
      loadItems: async () =>
        groupBookmarksByChange(await listBookmarksByChange(pi, cwd)),
      filterItems: (items, query) =>
        filterBookmarks(items, query, filterModeRef.value),
      onKey: createKeyboardHandler({
        bindings: [createToggleFilterBinding(filterModeRef)],
      }),
      formatItem: (item, width, t) => formatBookmarkLine(item, width, t),
      loadPreview: async (item) => {
        const { diff } = await getRawDiff(pi, cwd, item.changeId);
        const theme = await getTheme(pi, cwd);
        return renderDiffWithShiki(diff, theme);
      },
    },
  );

  pickerRef = picker;
  return picker;
}
