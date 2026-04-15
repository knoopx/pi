import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import { createKeyboardHandler } from "../keyboard";
import {
  createListPicker,
  type ListPickerItem,
  type ListPickerComponent,
  type ListPickerAction,
} from "./list-picker";
import { formatSymbolListEntry } from "./symbol-utils";
import { createFilePreviewLoader } from "./preview-utils";
import type { SymbolReferenceActionType } from "./symbol-references";

interface SymbolInfo extends ListPickerItem {
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
}

export interface SymbolResult {
  symbol: SymbolInfo;
  action?: SymbolReferenceActionType;
  insertType?: "name" | "path";
}

async function querySymbols(
  pi: ExtensionAPI,
  cwd: string,
  query: string,
  typeFilter?: SymbolTypeFilter,
): Promise<SymbolInfo[]> {
  const args = ["query", query, "--format", "ai"];
  if (typeFilter && typeFilter !== "all") args.push("--type", typeFilter);
  const result = await pi.exec("cm", args, { cwd });
  if (result.code !== 0) return [];

  const lines = result.stdout
    .split("\n")
    .filter((line) => line.includes("|") && !line.startsWith("["));

  const isTestFile = (path: string) =>
    /\.(test|spec)\.[jt]sx?$/.test(path) || path.includes("__tests__");

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
    .filter(
      (s): s is SymbolInfo =>
        s !== null && !!s.name && !!s.path && !isTestFile(s.path),
    );
}

// Symbol types available for filtering (cycle order)
const SYMBOL_TYPES = ["class", "function", "method", "enum", "all"] as const;
type SymbolTypeFilter = (typeof SYMBOL_TYPES)[number];

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
  let pendingAction: SymbolReferenceActionType | undefined;
  let pendingInsertType: "name" | "path" | undefined;

  const currentTypeRef = { value: "class" as SymbolTypeFilter };

  function createToggleSymbolTypeBinding(ref: { value: SymbolTypeFilter }) {
    return {
      key: Key.ctrl("/"),
      handler() {
        const currentIndex = SYMBOL_TYPES.indexOf(ref.value);
        const nextIndex = (currentIndex + 1) % SYMBOL_TYPES.length;
        ref.value = SYMBOL_TYPES[nextIndex];
      },
    };
  }

  // Wrapper to close picker with action metadata
  function doneWithAction(item: SymbolInfo | null): void {
    if (item && pendingAction) done({ symbol: item, action: pendingAction });
    else if (item && pendingInsertType)
      done({ symbol: item, insertType: pendingInsertType });
    else if (item) done({ symbol: item });
    else {
      done(null);
    }
    pendingAction = undefined;
    pendingInsertType = undefined;
  }

  function getInspectAction(type: string): SymbolReferenceActionType {
    if (
      type === "f" ||
      type === "m" ||
      type === "function" ||
      type === "method"
    )
      return "callers";
    return "used-by";
  }

  async function goToFirstResult(
    command: string,
    args: string[],
  ): Promise<void> {
    const result = await pi.exec("cm", [command, ...args, "--format", "ai"], {
      cwd,
    });
    if (result.code !== 0 || !result.stdout.trim()) return;

    const firstLine = result.stdout
      .split("\n")
      .find((l) => l.includes("|") && !l.startsWith("["));
    if (!firstLine) return;

    const match = /\|([^|]+)\|(\d+)-/.exec(firstLine);
    if (!match) return;

    const [, filePath, line] = match;
    const { join } = await import("node:path");
    await pi.exec("editor", [`${join(cwd, filePath)}:${line}`]);
  }

  // Actions that show results in picker
  const PICKER_ACTIONS: [string, SymbolReferenceActionType][] = [
    [Key.ctrl("j"), "callees"],
    [Key.ctrl("k"), "schema"],
  ];

  const actions: ListPickerAction<SymbolInfo>[] = [
    {
      key: Key.ctrl("i"),
      label: "insert",
      handler(item: SymbolInfo) {
        pendingInsertType = "name";
        doneWithAction(item);
      },
    },
    // Dynamic ctrl+t action based on symbol type
    {
      key: Key.ctrl("t"),
      label: "callers",
      handler(item: SymbolInfo) {
        pendingAction = getInspectAction(item.type);
        doneWithAction(item);
      },
    },
    // Go to types directly
    {
      key: Key.ctrl("y"),
      label: "types",
      handler(item: SymbolInfo) {
        void goToFirstResult("types", [item.name]);
      },
    },
    // Actions that show picker
    ...PICKER_ACTIONS.map(([key, action]) => ({
      key,
      label: action,
      handler(item: SymbolInfo) {
        pendingAction = action;
        doneWithAction(item);
      },
    })),
  ];

  // Internal done handler that wraps results
  const internalDone = (item: SymbolInfo | null) => {
    if (item) done({ symbol: item });
    else {
      done(null);
    }
  };

  // Helper to get the dynamic title
  const getTitle = () =>
    `Symbols [${currentTypeRef.value === "all" ? "*" : currentTypeRef.value}]`;

  const picker = createListPicker<SymbolInfo>(
    pi,
    tui,
    theme,
    keybindings,
    internalDone,
    initialQuery,
    {
      title: getTitle,
      actions,
      async onEdit(item) {
        const { join } = await import("node:path");
        await pi.exec("editor", [
          `${join(cwd, item.path)}:${String(item.startLine)}`,
        ]);
      },
      loadItems: (query) => querySymbols(pi, cwd, query, currentTypeRef.value),
      filterItems: (items, query) =>
        items.filter((s) => s.name.toLowerCase().includes(query)),
      reloadDebounceMs: 300,
      formatItem: (item, width, theme) =>
        formatSymbolListEntry(theme, { ...item, line: item.startLine }),
      loadPreview: createFilePreviewLoader(pi, cwd, theme),
      onKey: createKeyboardHandler({ bindings: [createToggleSymbolTypeBinding(currentTypeRef)] }),
    },
  );

  return {
    ...picker,
    invalidate() {
      // Trigger re-render
    },
  };
}
