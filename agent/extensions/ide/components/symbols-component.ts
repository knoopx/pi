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
import {
  formatSymbolListEntry,
  loadFilePreviewWithBat,
  applyFocusedStyle,
} from "./utils";
import type { CmActionType } from "./cm-results-component";

export interface SymbolInfo extends ListPickerItem {
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
}

export interface SymbolResult {
  symbol: SymbolInfo;
  action?: CmActionType;
}

async function querySymbols(
  pi: ExtensionAPI,
  cwd: string,
  query: string,
): Promise<SymbolInfo[]> {
  const result = await pi.exec(
    "cm",
    ["query", query, "--format", "ai", "--limit", "500"],
    { cwd },
  );
  if (result.code !== 0) {
    return [];
  }

  const lines = result.stdout
    .split("\n")
    .filter((line) => line.includes("|") && !line.startsWith("["));

  return lines
    .map((line) => {
      const match = /^(.+)\|([a-z_]+)\|(\.[^|]+)\|(\d+-\d+)/.exec(line);
      if (!match) return null;

      const [, name, type, path, lineRange] = match;
      const [startLine, endLine] = lineRange.split("-").map(Number);

      const normalizedStartLine = Number.isNaN(startLine) ? 1 : startLine;
      const normalizedEndLine = Number.isNaN(endLine)
        ? normalizedStartLine
        : endLine;

      return {
        id: `${path}:${String(normalizedStartLine)}`,
        label: name || "",
        name: name || "",
        type: type || "f",
        path: path || "",
        startLine: normalizedStartLine,
        endLine: normalizedEndLine,
      };
    })
    .filter((s): s is SymbolInfo => s !== null && !!s.name && !!s.path);
}

export function createSymbolsComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: SymbolResult | null) => void,
  initialQuery: string,
  cwd: string,
): ListPickerComponent & { invalidate: () => void } {
  // Track pending action for when an action key is pressed
  let pendingAction: CmActionType | undefined;

  // Wrapper to close picker with action metadata
  function doneWithAction(item: SymbolInfo | null): void {
    if (item && pendingAction) {
      done({ symbol: item, action: pendingAction });
    } else if (item) {
      done({ symbol: item });
    } else {
      done(null);
    }
    pendingAction = undefined;
  }

  // Action definitions: [key, label/action]
  const ACTION_DEFS: [string, CmActionType][] = [
    ["ctrl+i", "callers"],
    ["ctrl+l", "callees"],
    ["ctrl+t", "tests"],
    ["ctrl+y", "types"],
    ["ctrl+s", "schema"],
  ];

  const actions: ListPickerAction<SymbolInfo>[] = ACTION_DEFS.map(
    ([key, action]) => ({
      key,
      label: action,
      handler: (item: SymbolInfo) => {
        pendingAction = action;
        doneWithAction(item);
      },
    }),
  );

  // Internal done handler that wraps results
  const internalDone = (item: SymbolInfo | null) => {
    if (item) {
      done({ symbol: item });
    } else {
      done(null);
    }
  };

  const picker = createListPicker<SymbolInfo>(
    pi,
    tui,
    theme,
    keybindings,
    internalDone,
    initialQuery,
    {
      title: "Symbols",
      helpParts: ["↑↓ nav", "type to search"],
      actions,
      onEdit: async (item) => {
        const { join } = await import("node:path");
        await pi.exec("code", [
          "-g",
          `${join(cwd, item.path)}:${String(item.startLine)}`,
        ]);
      },
      loadItems: (query) => querySymbols(pi, cwd, query),
      filterItems: (items, query) =>
        items.filter((s) => s.name.toLowerCase().includes(query)),
      reloadDebounceMs: 300,
      formatItem: (item, _width, theme, isFocused) =>
        applyFocusedStyle(
          theme,
          formatSymbolListEntry(theme, { ...item, line: item.startLine }),
          isFocused,
        ),
      loadPreview: (item) => loadFilePreviewWithBat(pi, item.path, cwd),
    },
  );

  return {
    ...picker,
    invalidate: () => {
      // Trigger re-render
    },
  };
}
