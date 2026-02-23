import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  createListPicker,
  type ListPickerItem,
  type ListPickerComponent,
  type ListPickerAction,
} from "./list-picker";
import { formatBookmarkReference } from "./change-utils";
import { applyFocusedStyle } from "./style-utils";
import { forgetBookmark, getDiff, listBookmarksByChange } from "../jj";

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
    if (existing) {
      existing.bookmarks.push(entry.bookmark);
    } else {
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

// Filter modes for bookmarks (cycle order)
const BOOKMARK_FILTER_MODES = [
  "all",
  "bookmarks",
  "descriptions",
  "authors",
] as const;
type BookmarkFilterMode = (typeof BOOKMARK_FILTER_MODES)[number];

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
  let notify: (message: string, type?: "info" | "error") => void = () => {};
  // Current filter mode (defaults to all)
  let currentFilterMode: BookmarkFilterMode = "all";

  const actions: ListPickerAction<BookmarkEntry>[] = [
    {
      key: ACTION_KEYS.delete,
      label: "delete",
      handler: async (item) => {
        for (const bookmark of item.bookmarks) {
          await forgetBookmark(pi, cwd, bookmark);
        }
        notify(`Forgot ${item.bookmarks.length} bookmark(s)`, "info");
        await pickerRef?.reload();
      },
    },
    {
      key: "ctrl+g",
      label: "fetch",
      handler: async () => {
        const result = await pi.exec("jj", ["git", "fetch"], { cwd });
        if (result.code === 0) {
          notify("Fetched all from remote", "info");
        } else {
          notify(result.stderr || "Fetch failed", "error");
        }
        await pickerRef?.reload();
      },
    },
    {
      key: "ctrl+p",
      label: "push",
      handler: async () => {
        const result = await pi.exec("jj", ["git", "push", "--all"], { cwd });
        if (result.code === 0) {
          notify("Pushed all bookmarks", "info");
        } else {
          notify(result.stderr || "Push failed", "error");
        }
        await pickerRef?.reload();
      },
    },
    {
      key: "ctrl+i",
      label: "insert",
      handler: (item) => {
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
      loadItems: async (_query) => {
        const entries = await listBookmarksByChange(pi, cwd);
        return groupBookmarksByChange(entries);
      },
      filterItems: (items, query) => {
        const lowerQuery = query.toLowerCase();
        switch (currentFilterMode) {
          case "all":
            return items.filter(
              (item) =>
                item.bookmarks.some((b) =>
                  b.toLowerCase().includes(lowerQuery),
                ) ||
                item.description.toLowerCase().includes(lowerQuery) ||
                item.author.toLowerCase().includes(lowerQuery),
            );
          case "bookmarks":
            return items.filter((item) =>
              item.bookmarks.some((b) => b.toLowerCase().includes(lowerQuery)),
            );
          case "descriptions":
            return items.filter((item) =>
              item.description.toLowerCase().includes(lowerQuery),
            );
          case "authors":
            return items.filter((item) =>
              item.author.toLowerCase().includes(lowerQuery),
            );
          default:
            return items;
        }
      },
      onKey: createKeyboardHandler({
        bindings: [
          {
            key: "ctrl+/",
            handler: () => {
              const currentIndex =
                BOOKMARK_FILTER_MODES.indexOf(currentFilterMode);
              const nextIndex =
                (currentIndex + 1) % BOOKMARK_FILTER_MODES.length;
              currentFilterMode = BOOKMARK_FILTER_MODES[nextIndex];
              void picker.reload();
              notify(`Filter: ${currentFilterMode}`, "info");
            },
          },
        ],
      }),
      formatItem: (item, width, theme, isFocused) => {
        const bookmarkLabels = item.displayNames
          .map((name) => formatBookmarkReference(theme, name))
          .join(" ");
        const sep = " · ";
        const author = item.author || "";

        // Calculate available space for description
        const bookmarkLen = item.displayNames.reduce(
          (sum, n) => sum + n.length + 5,
          0,
        );
        const fixedLen = bookmarkLen + sep.length + author.length + sep.length;
        const maxDescLen = Math.max(10, width - fixedLen);
        const desc =
          item.description.length > maxDescLen
            ? item.description.slice(0, maxDescLen - 1) + "…"
            : item.description;

        const styledSep = isFocused ? sep : theme.fg("dim", sep);
        const styledDesc = isFocused ? desc : theme.fg("dim", desc);
        const styledAuthor = author ? theme.fg("dim", author) : "";

        const parts = [bookmarkLabels, styledDesc, styledAuthor].filter(
          Boolean,
        );
        return applyFocusedStyle(theme, parts.join(styledSep), isFocused);
      },
      loadPreview: async (item) => {
        return getDiff(pi, cwd, item.changeId);
      },
    },
  );

  // Wire up notify to use the picker's internal showStatus
  notify = (message, type) => {
    picker.notify?.(message, type);
  };

  pickerRef = picker;
  return picker;
}
