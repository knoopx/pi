import { matchesKey } from "@mariozechner/pi-tui";
import {
  buildHelpText,
  ensureWidth,
  formatBookmarkReference,
  pad,
  truncateAnsi,
} from "./utils";
import { forgetBookmark, listBookmarksByChange } from "../jj";
import type { BaseComponentParams } from "./shared-utils";

interface BookmarkEntry {
  bookmark: string;
  changeId: string;
  description: string;
}

export function createBookmarksComponent(
  { pi, tui, theme, cwd }: BaseComponentParams,
  done: (result: void) => void,
  onInsert?: (text: string) => void,
) {
  let bookmarks: BookmarkEntry[] = [];
  let selectedIndex = 0;
  let loading = true;
  let error: string | null = null;
  let cachedLines: string[] = [];
  let cachedWidth = 0;

  async function load(): Promise<void> {
    try {
      loading = true;
      error = null;

      const entries = await listBookmarksByChange(pi, cwd);
      bookmarks = entries.map((entry) => ({
        bookmark: entry.bookmark,
        changeId: entry.changeId,
        description: entry.description || "(no description)",
      }));

      selectedIndex = Math.min(
        selectedIndex,
        Math.max(0, bookmarks.length - 1),
      );
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
      invalidate();
      tui.requestRender();
    }
  }

  async function forgetSelected(): Promise<void> {
    const selected = bookmarks[selectedIndex];
    if (!selected) {
      return;
    }

    try {
      await forgetBookmark(pi, cwd, selected.bookmark);
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      invalidate();
      tui.requestRender();
    }
  }

  async function fetchBookmarks(): Promise<void> {
    try {
      loading = true;
      error = null;
      invalidate();
      tui.requestRender();

      const result = await pi.exec("jj", ["git", "fetch"], { cwd });
      if (result.code !== 0) {
        error = result.stderr || "Failed to fetch bookmarks";
      }

      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      loading = false;
      invalidate();
      tui.requestRender();
    }
  }

  async function pushSelectedBookmark(): Promise<void> {
    const selected = bookmarks[selectedIndex];
    const bookmarkName = selected?.bookmark.split("@")[0]?.trim();
    if (!bookmarkName) {
      return;
    }

    try {
      loading = true;
      error = null;
      invalidate();
      tui.requestRender();

      const result = await pi.exec(
        "jj",
        ["git", "push", "--bookmark", bookmarkName],
        { cwd },
      );
      if (result.code !== 0) {
        error = result.stderr || `Failed to push bookmark '${bookmarkName}'`;
      }

      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      loading = false;
      invalidate();
      tui.requestRender();
    }
  }

  function invalidate(): void {
    cachedLines = [];
    cachedWidth = 0;
  }

  function render(width: number): string[] {
    if (cachedWidth === width && cachedLines.length > 0) {
      return cachedLines;
    }

    const lines: string[] = [];
    const height = Math.floor(tui.terminal.rows * 0.8);
    const contentHeight = Math.max(6, height - 5);

    lines.push(theme.fg("borderAccent", `┌${"─".repeat(width - 2)}┐`));
    lines.push(
      theme.fg("borderAccent", "│") +
        theme.fg("accent", pad(" Bookmarks", width - 2)) +
        theme.fg("borderAccent", "│"),
    );
    lines.push(theme.fg("border", `├${"─".repeat(width - 2)}┤`));

    if (loading) {
      lines.push(
        theme.fg("border", "│") +
          theme.fg("dim", pad(" Loading...", width - 2)) +
          theme.fg("border", "│"),
      );
    } else if (error) {
      lines.push(
        theme.fg("border", "│") +
          theme.fg(
            "error",
            pad(` Error: ${truncateAnsi(error, width - 11)}`, width - 2),
          ) +
          theme.fg("border", "│"),
      );
    } else if (bookmarks.length === 0) {
      lines.push(
        theme.fg("border", "│") +
          theme.fg("dim", pad(" No bookmarks", width - 2)) +
          theme.fg("border", "│"),
      );
    } else {
      let startIdx = 0;
      if (selectedIndex >= contentHeight) {
        startIdx = selectedIndex - contentHeight + 1;
      }

      for (
        let i = 0;
        i < contentHeight && startIdx + i < bookmarks.length;
        i++
      ) {
        const idx = startIdx + i;
        const entry = bookmarks[idx]!;
        const isSelected = idx === selectedIndex;

        const shortId = entry.changeId.slice(-8);
        const right = ` ${shortId}`;
        const leftWidth = Math.max(1, width - 2 - right.length);
        const reference = formatBookmarkReference(theme, entry.bookmark);
        const leftText = ` ${reference} ${entry.description}`;
        const left = ensureWidth(truncateAnsi(leftText, leftWidth), leftWidth);
        const row = ensureWidth(left + theme.fg("dim", right), width - 2);
        const styled = isSelected ? theme.fg("accent", theme.bold(row)) : row;

        lines.push(theme.fg("border", "│") + styled + theme.fg("border", "│"));
      }
    }

    while (lines.length < height - 2) {
      lines.push(
        theme.fg("border", "│") + pad("", width - 2) + theme.fg("border", "│"),
      );
    }

    lines.push(theme.fg("border", `├${"─".repeat(width - 2)}┤`));
    lines.push(
      theme.fg("border", "│") +
        theme.fg(
          "dim",
          pad(
            ` ${buildHelpText("↑↓ nav", "f forget", "i insert", "g fetch", "p push", "r refresh", "esc close")}`,
            width - 2,
          ),
        ) +
        theme.fg("border", "│"),
    );
    lines.push(theme.fg("border", `└${"─".repeat(width - 2)}┘`));

    cachedWidth = width;
    cachedLines = lines;
    return lines;
  }

  function handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q") {
      done();
      return;
    }

    if (loading) {
      return;
    }

    if (matchesKey(data, "up")) {
      selectedIndex = Math.max(0, selectedIndex - 1);
      invalidate();
      tui.requestRender();
      return;
    }

    if (matchesKey(data, "down")) {
      selectedIndex = Math.min(bookmarks.length - 1, selectedIndex + 1);
      invalidate();
      tui.requestRender();
      return;
    }

    if (data === "f") {
      void forgetSelected();
      return;
    }

    if (data === "r") {
      void load();
      return;
    }

    if (data === "g") {
      void fetchBookmarks();
      return;
    }

    if (data === "p") {
      void pushSelectedBookmark();
      return;
    }

    if (data === "i") {
      const selected = bookmarks[selectedIndex];
      if (selected && onInsert) {
        onInsert(selected.bookmark);
        done();
      }
      return;
    }
  }

  void load();

  return {
    render,
    handleInput,
    invalidate,
    dispose() {},
  };
}
