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
import { formatBookmarkReference, applyFocusedStyle } from "./utils";
import { forgetBookmark, getDiff, listBookmarksByChange } from "../jj";

interface BookmarkEntry extends ListPickerItem {
  bookmarks: string[];
  changeId: string;
  description: string;
}

function groupBookmarksByChange(
  entries: { bookmark: string; changeId: string; description: string }[],
): BookmarkEntry[] {
  const byChange = new Map<
    string,
    { bookmarks: string[]; description: string }
  >();

  for (const entry of entries) {
    const existing = byChange.get(entry.changeId);
    if (existing) {
      existing.bookmarks.push(entry.bookmark);
    } else {
      byChange.set(entry.changeId, {
        bookmarks: [entry.bookmark],
        description: entry.description,
      });
    }
  }

  return Array.from(byChange.entries()).map(
    ([changeId, { bookmarks, description }]) => ({
      id: changeId,
      label: bookmarks.join(" "),
      bookmarks,
      changeId,
      description: description || "(no description)",
    }),
  );
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
  let notify: (message: string, type?: "info" | "error") => void = () => {};

  const actions: ListPickerAction<BookmarkEntry>[] = [
    {
      key: "ctrl+f",
      label: "forget",
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
          notify("Fetched from remote", "info");
        } else {
          notify(result.stderr || "Fetch failed", "error");
        }
        await pickerRef?.reload();
      },
    },
    {
      key: "ctrl+p",
      label: "push",
      handler: async (item) => {
        const bookmarkName = item.bookmarks[0]?.split("@")[0]?.trim();
        if (!bookmarkName) return;
        const result = await pi.exec(
          "jj",
          ["git", "push", "--bookmark", bookmarkName],
          { cwd },
        );
        if (result.code === 0) {
          notify(`Pushed ${bookmarkName}`, "info");
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
      helpParts: ["↑↓ nav", "type to filter"],
      actions,
      loadItems: async (_query) => {
        const entries = await listBookmarksByChange(pi, cwd);
        return groupBookmarksByChange(entries);
      },
      filterItems: (items, query) =>
        items.filter(
          (item) =>
            item.bookmarks.some((b) => b.toLowerCase().includes(query)) ||
            item.description.toLowerCase().includes(query),
        ),
      formatItem: (item, _width, theme, isFocused) => {
        const shortId = item.changeId.slice(-8);
        const bookmarkLabels = item.bookmarks
          .map((b) => formatBookmarkReference(theme, b, isFocused))
          .join(" ");
        const separator = isFocused ? " · " : theme.fg("dim", " · ");
        const description = isFocused
          ? item.description
          : theme.fg("dim", item.description);
        const idLabel = isFocused ? shortId : theme.fg("dim", shortId);
        return applyFocusedStyle(
          theme,
          `${bookmarkLabels}${separator}${description}${separator}${idLabel}`,
          isFocused,
        );
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
