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
import { loadFilePreviewWithBat, getSymbolIcon } from "./utils";
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
    ["ctrl+c", "callers"],
    ["ctrl+l", "callees"],
    ["ctrl+t", "tests"],
    ["ctrl+y", "types"],
    ["ctrl+s", "schema"],
    ["ctrl+i", "impact"],
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
          `${join(cwd, item.path)}:${item.startLine}`,
        ]);
      },
      loadItems: async () => {
        const result = await pi.exec(
          "cm",
          ["query", "", "--format", "ai", "--limit", "2000"],
          { cwd },
        );
        if (result.code !== 0) {
          throw new Error(`Failed to load symbols: ${result.stderr}`);
        }

        // Parse cm output: name|type|path|line-range
        const lines = result.stdout
          .split("\n")
          .filter((line) => line.includes("|") && !line.startsWith("["));
        const parsedSymbols = lines
          .map((line) => {
            const match = line.match(/^(.+)\|([a-z_]+)\|(\.[^|]+)\|(\d+-\d+)$/);
            if (!match) return null;

            const [, name, type, path, lineRange] = match;
            const [startLine, endLine] = lineRange!.split("-").map(Number);

            return {
              id: `${path}:${startLine}`,
              label: name || "",
              name: name || "",
              type: type || "f",
              path: path || "",
              startLine: startLine || 1,
              endLine: endLine || startLine || 1,
            };
          })
          .filter((s): s is SymbolInfo => s !== null && !!s.name && !!s.path);

        // Sort by file modification time
        const uniquePaths = [...new Set(parsedSymbols.map((s) => s.path))];
        const fileMtimes = new Map<string, number>();
        const { statSync } = await import("node:fs");
        const { join } = await import("node:path");

        for (const p of uniquePaths) {
          try {
            const fullPath = join(cwd, p);
            const stat = statSync(fullPath);
            fileMtimes.set(p, stat.mtimeMs);
          } catch {
            // File doesn't exist or can't be accessed
          }
        }

        return parsedSymbols.sort((a, b) => {
          const mtimeA = fileMtimes.get(a.path) || 0;
          const mtimeB = fileMtimes.get(b.path) || 0;
          if (mtimeB !== mtimeA) return mtimeB - mtimeA;
          return a.startLine - b.startLine;
        });
      },
      filterItems: (items, query) =>
        items.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.path.toLowerCase().includes(query),
        ),
      formatItem: (item, _width, theme) => {
        const icon = getSymbolIcon(item.type);
        const pathShort = item.path.replace(/^\.\//, "");
        return `${icon} ${item.name} ${theme.fg("dim", `${pathShort}:${item.startLine}`)}`;
      },
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
