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

  // Get context-sensitive action for ctrl+i based on symbol type
  function getInspectAction(type: string): CmActionType {
    // Functions and methods → show callers
    if (
      type === "f" ||
      type === "m" ||
      type === "function" ||
      type === "method"
    ) {
      return "callers";
    }
    // Classes, interfaces, types, enums → show usages
    return "used-by";
  }

  // Navigate directly to first result from cm command
  async function goToFirstResult(
    command: string,
    args: string[],
  ): Promise<void> {
    const result = await pi.exec("cm", [command, ...args, "--format", "ai"], {
      cwd,
    });
    if (result.code !== 0 || !result.stdout.trim()) return;

    // Parse first result line: name|type|path|line-range
    const firstLine = result.stdout
      .split("\n")
      .find((l) => l.includes("|") && !l.startsWith("["));
    if (!firstLine) return;

    const match = /\|([^|]+)\|(\d+)-/.exec(firstLine);
    if (!match) return;

    const [, filePath, line] = match;
    const { join } = await import("node:path");
    await pi.exec("code", ["-g", `${join(cwd, filePath)}:${line}`]);
  }

  // Actions that show results in picker
  const PICKER_ACTIONS: [string, CmActionType][] = [
    ["ctrl+l", "callees"],
    ["ctrl+s", "schema"],
  ];

  const actions: ListPickerAction<SymbolInfo>[] = [
    // Dynamic ctrl+i action based on symbol type
    {
      key: "ctrl+i",
      label: "inspect",
      handler: (item: SymbolInfo) => {
        pendingAction = getInspectAction(item.type);
        doneWithAction(item);
      },
    },
    // Go to tests directly
    {
      key: "ctrl+t",
      label: "tests",
      handler: (item: SymbolInfo) => {
        void goToFirstResult("tests", [item.name]);
      },
    },
    // Go to types directly
    {
      key: "ctrl+y",
      label: "types",
      handler: (item: SymbolInfo) => {
        void goToFirstResult("types", [item.name]);
      },
    },
    // Actions that show picker
    ...PICKER_ACTIONS.map(([key, action]) => ({
      key,
      label: action,
      handler: (item: SymbolInfo) => {
        pendingAction = action;
        doneWithAction(item);
      },
    })),
  ];

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
