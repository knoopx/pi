import type { KeybindingsManager, Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, SelectList, type SelectItem } from "@mariozechner/pi-tui";
import { buildHelpText, pad } from "./utils";

export function createBookmarkPromptComponent(
  tui: { requestRender: () => void },
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result: string | null) => void,
  changeId: string,
  bookmarks: string[],
) {
  const items: SelectItem[] = bookmarks.map((bookmark) => ({
    value: bookmark,
    label: bookmark,
  }));

  const selectList = new SelectList(
    items,
    Math.min(Math.max(items.length, 4), 12),
    {
      selectedPrefix: (text: string) => theme.fg("accent", `${text}`),
      selectedText: (text: string) => theme.fg("accent", theme.bold(text)),
      description: (text: string) => theme.fg("muted", text),
      scrollInfo: (text: string) => theme.fg("dim", text),
      noMatch: (text: string) => theme.fg("warning", text),
    },
  );

  selectList.onSelect = (item: SelectItem) => done(item.value);
  selectList.onCancel = () => done(null);

  function render(width: number): string[] {
    const title = theme.fg(
      "accent",
      pad(` Select bookmark for ${changeId.slice(0, 8)}`, width),
    );
    const separator = theme.fg("border", "─".repeat(width));
    const help = theme.fg(
      "dim",
      pad(` ${buildHelpText("↑↓ nav", "enter select", "esc cancel")}`, width),
    );

    if (items.length === 0) {
      return [
        title,
        separator,
        pad(theme.fg("dim", " No bookmarks found"), width),
        separator,
        theme.fg("dim", pad(" Press Esc to cancel", width)),
      ];
    }

    return [title, separator, ...selectList.render(width), separator, help];
  }

  return {
    render,
    handleInput(data: string) {
      if (items.length === 0) {
        if (matchesKey(data, "escape") || matchesKey(data, "enter")) {
          done(null);
        }
        return;
      }

      selectList.handleInput(data);
      tui.requestRender();
    },
    invalidate() {
      selectList.invalidate();
    },
    dispose() {},
  };
}
