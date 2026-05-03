import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
} from "../../lib/list-picker";
import type { SearchResult } from "./types";
import {
  runSearch,
  filterResults,
  formatSearchResult,
  countAnsiBytes,
} from "./helpers";
import { loadPreviewFromPath } from "../../lib/file-preview";

interface SearchComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: SearchResult | null) => void;
  initialQuery: string;
  ctx: ExtensionContext;
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
          const fullPreview = await loadPreviewFromPath(
            ctx.cwd,
            item.path,
            theme,
          );
          if (item.matchedText && fullPreview.length > 0) {
            const idx = item.lineText
              .toLowerCase()
              .indexOf(item.matchedText.toLowerCase());
            if (idx !== -1) {
              const before = item.lineText.slice(0, idx);
              const matched = item.matchedText;
              const ansiBefore = countAnsiBytes(fullPreview[0], before);
              const remaining = fullPreview[0].slice(ansiBefore);
              const ansiMatched = countAnsiBytes(remaining, matched);
              const ansiAfterStart = ansiBefore + ansiMatched;
              fullPreview[0] =
                fullPreview[0].slice(0, ansiBefore) +
                theme.fg("accent", theme.bold(matched)) +
                fullPreview[0].slice(ansiAfterStart);
            }
          }
          return fullPreview;
        } catch {
          return [];
        }
      },
      actions: [
        {
          key: Key.ctrl("e"),
          label: "edit",
          handler(item) {
            void import("../../lib/editor-utils").then(({ openEditor }) => {
              void openEditor(pi, ctx, `${item.path}:${item.lineNum}`);
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
