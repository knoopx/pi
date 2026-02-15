import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  createNonSelectableListPicker,
  type ListPickerItem,
  type ListPickerComponent,
  type ListPickerAction,
} from "./list-picker";
import { formatBookmarkReference } from "./utils";
import { forgetBookmark, getDiff, listBookmarksByChange } from "../jj";

interface BookmarkEntry extends ListPickerItem {
  bookmark: string;
  changeId: string;
  description: string;
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

  const actions: ListPickerAction<BookmarkEntry>[] = [
    {
      key: "f",
      label: "forget",
      handler: async (item) => {
        await forgetBookmark(pi, cwd, item.bookmark);
        await pickerRef?.reload();
      },
    },
    {
      key: "g",
      label: "fetch",
      handler: async () => {
        await pi.exec("jj", ["git", "fetch"], { cwd });
        await pickerRef?.reload();
      },
    },
    {
      key: "p",
      label: "push",
      handler: async (item) => {
        const bookmarkName = item.bookmark.split("@")[0]?.trim();
        if (!bookmarkName) return;
        await pi.exec("jj", ["git", "push", "--bookmark", bookmarkName], {
          cwd,
        });
        await pickerRef?.reload();
      },
    },
    {
      key: "i",
      label: "insert",
      handler: (item) => {
        if (onInsert) {
          onInsert(item.bookmark);
          done(null);
        }
      },
    },
  ];

  const picker = createNonSelectableListPicker<BookmarkEntry>(
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
      loadItems: async () => {
        const entries = await listBookmarksByChange(pi, cwd);
        return entries.map((entry) => ({
          id: entry.bookmark,
          label: entry.bookmark,
          bookmark: entry.bookmark,
          changeId: entry.changeId,
          description: entry.description || "(no description)",
        }));
      },
      filterItems: (items, query) =>
        items.filter(
          (item) =>
            item.bookmark.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query),
        ),
      formatItem: (item, _width, theme) => {
        const shortId = item.changeId.slice(-8);
        const bookmarkLabel = formatBookmarkReference(theme, item.bookmark);
        const separator = theme.fg("dim", " · ");
        const idLabel = theme.fg("dim", shortId);
        return `${bookmarkLabel}${separator}${item.description}${separator}${idLabel}`;
      },
      loadPreview: async (item) => {
        return getDiff(pi, cwd, item.changeId);
      },
    },
  );

  pickerRef = picker;
  return picker;
}
