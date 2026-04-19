import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
  type ListPickerAction,
} from "../../lib/list-picker";

import { forgetBookmark } from "../../jj/bookmarks";
import { renderDiffWithShiki } from "../../tools/diff";
import { THEME } from "../../tools/shiki-constants";
import { ACTION_KEYS, createKeyboardHandler } from "../../keyboard";
import type { BookmarkFilterMode } from "../../lib/types";
import { notifyMutation } from "../../jj/core";
import { getRawDiff } from "../../jj/files";
import { listBookmarksByChange } from "../../jj/bookmarks";
import { type BookmarkEntry } from "./types";
import {
  groupBookmarksByChange,
  createToggleFilterBinding,
  formatBookmarkLine,
  filterBookmarksByMode,
} from "./helpers";

interface BookmarksComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: BookmarkEntry | null) => void;
  cwd: string;
  onInsert?: (text: string) => void;
}

function buildBookmarkActions(options: {
  pi: ExtensionAPI;
  cwd: string;
  done: (result: BookmarkEntry | null) => void;
  onInsert?: (text: string) => void;
  pickerRef: { current: ListPickerComponent | null };
}): ListPickerAction<BookmarkEntry>[] {
  const { pi, cwd, done, onInsert, pickerRef } = options;

  const newAction = makeNewBookmarkAction(pi, cwd, done);
  const deleteAction = makeDeleteBookmarkAction(pi, cwd, pickerRef);
  const fetchAction = makeFetchAction(pi, cwd, pickerRef);
  const pushAction = makePushAction(pi, cwd, pickerRef);
  const insertAction = makeInsertBookmarkAction(onInsert, done);

  return [newAction, deleteAction, fetchAction, pushAction, insertAction];
}

function makeNewBookmarkAction(
  pi: ExtensionAPI,
  cwd: string,
  done: (result: BookmarkEntry | null) => void,
): ListPickerAction<BookmarkEntry> {
  return {
    key: Key.ctrl("n"),
    label: "new",
    async handler(item: BookmarkEntry) {
      const result = await pi.exec("jj", ["new", "-r", item.changeId], {
        cwd,
      });
      handleNewBookmarkResult(pi, item, result, done);
    },
  };
}

function handleNewBookmarkResult(
  pi: ExtensionAPI,
  item: BookmarkEntry,
  result: { code: number; stderr: string; stdout: string },
  done: (result: BookmarkEntry | null) => void,
): void {
  const shortId = item.changeId.slice(0, 8);
  const label = item.displayNames[0] || item.changeId;

  if (result.code === 0) {
    notifyMutation(
      pi,
      `Started work from change ${shortId} (${label})`,
      result.stderr || result.stdout,
    );
    done(null);
    return;
  }

  const errorMsg = buildNewBookmarkError(result.stderr, shortId);
  notifyMutation(pi, "error", errorMsg);
}

function buildNewBookmarkError(stderr: string, shortId: string): string {
  if (stderr) return stderr;
  return `Failed to start work from change ${shortId}`;
}

function makeDeleteBookmarkAction(
  pi: ExtensionAPI,
  cwd: string,
  pickerRef: { current: ListPickerComponent | null },
): ListPickerAction<BookmarkEntry> {
  return {
    key: ACTION_KEYS.delete,
    label: "delete",
    async handler(item: BookmarkEntry) {
      const outputs = await Promise.all(
        item.bookmarks.map((b) => forgetBookmark(pi, cwd, b)),
      );
      notifyMutation(
        pi,
        `Forgot bookmarks (${item.bookmarks.length}): ${item.bookmarks.join(", ")}`,
        outputs.join("\n"),
      );
      await pickerRef.current?.reload();
    },
  };
}

function makeFetchAction(
  pi: ExtensionAPI,
  cwd: string,
  pickerRef: { current: ListPickerComponent | null },
): ListPickerAction<BookmarkEntry> {
  return {
    key: Key.ctrl("g"),
    label: "fetch",
    async handler() {
      const result = await pi.exec("jj", ["git", "fetch"], { cwd });
      notifyMutation(
        pi,
        result.code === 0 ? "Fetched all bookmarks from all remotes" : "error",
        result.stderr || (result.code === 0 ? result.stdout : "Fetch failed"),
      );
      await pickerRef.current?.reload();
    },
  };
}

function makePushAction(
  pi: ExtensionAPI,
  cwd: string,
  pickerRef: { current: ListPickerComponent | null },
): ListPickerAction<BookmarkEntry> {
  return {
    key: Key.ctrl("p"),
    label: "push",
    async handler() {
      const result = await pi.exec("jj", ["git", "push", "--all"], { cwd });
      notifyMutation(
        pi,
        result.code === 0 ? "Pushed all local bookmarks to remote" : "error",
        result.stderr || (result.code === 0 ? result.stdout : "Push failed"),
      );
      await pickerRef.current?.reload();
    },
  };
}

function makeInsertBookmarkAction(
  onInsert: ((text: string) => void) | undefined,
  done: (result: BookmarkEntry | null) => void,
): ListPickerAction<BookmarkEntry> {
  return {
    key: Key.ctrl("i"),
    label: "insert",
    handler(item: BookmarkEntry) {
      if (onInsert) {
        onInsert(item.bookmarks[0] || item.changeId);
        done(null);
      }
    },
  };
}

function buildBookmarkPickerOptions(
  pi: ExtensionAPI,
  cwd: string,
  filterModeRef: { value: BookmarkFilterMode },
  actions: ListPickerAction<BookmarkEntry>[],
) {
  return {
    title: "Bookmarks",
    previewTitle: (item: BookmarkEntry) =>
      item.displayNames[0] ?? item.changeId.slice(0, 12),
    actions,
    loadItems: async () =>
      groupBookmarksByChange(await listBookmarksByChange(pi, cwd)),
    filterItems: (items: BookmarkEntry[], query: string): BookmarkEntry[] =>
      filterBookmarksByMode(items, query, filterModeRef.value),
    onKey: createKeyboardHandler({
      bindings: [createToggleFilterBinding(filterModeRef)],
    }),
    formatItem: (item: BookmarkEntry, width: number, t: Theme): string =>
      formatBookmarkLine(item, width, t),
    loadPreview: async (item: BookmarkEntry) => {
      const { diff } = await getRawDiff(pi, cwd, item.changeId);
      return renderDiffWithShiki(diff, THEME);
    },
  };
}

export function createBookmarksComponent(
  options: BookmarksComponentOptions,
): ListPickerComponent {
  const { pi, tui, theme, keybindings, done, cwd, onInsert } = options;
  const pickerRef: { current: ListPickerComponent | null } = { current: null };
  const filterModeRef = { value: "all" as BookmarkFilterMode };

  const actions = buildBookmarkActions({ pi, cwd, done, onInsert, pickerRef });
  const pickerOptions = buildBookmarkPickerOptions(
    pi,
    cwd,
    filterModeRef,
    actions,
  );

  const picker = createListPicker<BookmarkEntry>({
    pi,
    tui,
    theme,
    keybindings,
    done,
    initialQuery: "",
    config: pickerOptions,
  });

  pickerRef.current = picker;
  return picker;
}
