import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
import { renderListRows } from "./split-panel";
import { buildHelpText, ensureWidth, pad, truncateAnsi } from "./utils";
import { forgetBookmark, listBookmarks } from "../jj";

export function createBookmarksComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result: void) => void,
  cwd: string,
  onInsert?: (text: string) => void,
) {
  let bookmarks: string[] = [];
  let selectedIndex = 0;
  let loading = true;
  let error: string | null = null;
  let cachedLines: string[] = [];
  let cachedWidth = 0;

  async function load(): Promise<void> {
    try {
      loading = true;
      error = null;
      bookmarks = await listBookmarks(pi, cwd);
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
      await forgetBookmark(pi, cwd, selected);
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
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
      const rows = renderListRows(
        bookmarks.map((bookmark) => ({ text: bookmark })),
        width - 2,
        contentHeight,
        selectedIndex,
        theme,
      );

      for (const row of rows) {
        lines.push(
          theme.fg("border", "│") +
            ensureWidth(row, width - 2) +
            theme.fg("border", "│"),
        );
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
            ` ${buildHelpText("↑↓ nav", "f forget", "i insert", "r refresh", "esc close")}`,
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

    if (data === "i") {
      const selected = bookmarks[selectedIndex];
      if (selected && onInsert) {
        onInsert(selected);
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
