import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Key, type TUI } from "@earendil-works/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
} from "../../lib/list-picker/picker";
import type { SearchResult } from "./types";
import {
  runSearch,
  filterResults,
  formatSearchResult,
  countAnsiBytes,
} from "./rg-parsing";
import { loadPreviewFromPath } from "../../lib/file-preview";

interface SearchComponentOptions {
  pi: ExtensionAPI;
  tui: TUI;
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: SearchResult | null) => void;
  initialQuery: string;
  ctx: ExtensionContext;
}

function highlightMatchInPreview(
  preview: string[],
  item: SearchResult,
  theme: Theme,
): string[] {
  const idx = item.lineText
    .toLowerCase()
    .indexOf(item.matchedText.toLowerCase());
  if (idx === -1) return preview;

  const before = item.lineText.slice(0, idx);
  const matched = item.matchedText;
  const ansiBefore = countAnsiBytes(preview[0], before);
  const remaining = preview[0].slice(ansiBefore);
  const ansiMatched = countAnsiBytes(remaining, matched);
  const ansiAfterStart = ansiBefore + ansiMatched;
  preview[0] =
    preview[0].slice(0, ansiBefore) +
    theme.fg("accent", theme.bold(matched)) +
    preview[0].slice(ansiAfterStart);
  return preview;
}

export function createSearchComponent(
  options: SearchComponentOptions,
): ListPickerComponent {
  const { pi, tui, theme, keybindings, done, initialQuery, ctx } = options;
  return createListPicker<SearchResult>({
    pi,
    tui,
    theme,
    keybindings,
    done,
    initialQuery,
    config: {
      title: "Search",
      loadItems: (query) => runSearch(pi, ctx.cwd, query),
      filterItems: (items, query) => filterResults(items, query),
      reloadDebounceMs: 300,
      formatItem: (item, width) => formatSearchResult(width, theme, item),
      async loadPreview(item: SearchResult) {
        try {
          const preview = await loadPreviewFromPath(ctx.cwd, item.path, theme);
          if (!item.matchedText || preview.length === 0) return preview;
          return highlightMatchInPreview(preview, item, theme);
        } catch {
          return [];
        }
      },
      actions: [
        {
          key: Key.ctrl("e"),
          label: "edit",
          handler(item) {
            void import("../../lib/open-editor").then(({ openEditor }) => {
              void openEditor(tui, ctx, `${item.path}:${item.lineNum}`);
            });
            done(item);
          },
        },
        {
          key: Key.ctrl("i"),
          label: "insert",
          handler(item) {
            done(item);
          },
        },
      ],
    },
  });
}
