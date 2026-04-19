import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key, matchesKey } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
  type ListPickerAction,
} from "../../lib/list-picker";
import { formatSymbolListEntry } from "../../lib/symbol-utils";
import { createFilePreviewLoader } from "../../lib/preview-utils";
import type { SymbolReferenceActionType } from "../symbol-references/types";
import type { SymbolResult, SymbolInfo, SymbolTypeFilter } from "./types";
import { SYMBOL_TYPES } from "./types";
import { querySymbols } from "./helpers";
import { openEditor } from "../../lib/editor-utils";
// Symbol types available for filtering (cycle order)

interface SymbolsComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: SymbolResult | null) => void;
  initialQuery: string;
  ctx: ExtensionContext;
}


async function goToFirstResult(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  command: string,
  args: string[],
): Promise<void> {
  const result = await pi.exec("cm", [command, ...args, "--format", "ai"], {
    cwd: ctx.cwd,
  });
  if (result.code !== 0 || !result.stdout.trim()) return;

  const firstLine = result.stdout
    .split("\n")
    .find((l) => l.includes("|") && !l.startsWith("["));
  if (!firstLine) return;

  const match = /\|([^|]+)\|(\d+)-/.exec(firstLine);
  if (!match) return;

  const [, filePath, line] = match;
  await openEditor(pi, ctx, `${filePath}:${line}`);
}


const PICKER_ACTIONS: [string, SymbolReferenceActionType][] = [
  [Key.ctrl("j"), "callees"],
  [Key.ctrl("k"), "schema"],
];


function buildSymbolActions(
  doneWithAction: (item: SymbolInfo | null) => void,
  goToTypes: (name: string) => void,
): ListPickerAction<SymbolInfo>[] {
  return [
    {
      key: Key.ctrl("i"),
      label: "insert",
      handler(item: SymbolInfo) {
        doneWithAction(item);
      },
    },
    {
      key: Key.ctrl("t"),
      label: "callers",
      handler(item: SymbolInfo) {
        doneWithAction(item);
      },
    },
    {
      key: Key.ctrl("y"),
      label: "types",
      handler(item: SymbolInfo) {
        goToTypes(item.name);
      },
    },
    ...PICKER_ACTIONS.map(([key, action]) => ({
      key,
      label: action,
      handler(item: SymbolInfo) {
        doneWithAction(item);
      },
    })),
  ];
}


function buildSymbolPickerOptions(options: {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  theme: Theme;
  currentTypeRef: { value: SymbolTypeFilter };
  actions: ListPickerAction<SymbolInfo>[];
}) {
  const { pi, ctx, theme, currentTypeRef, actions } = options;
  return {
    title: () =>
      `Symbols [${currentTypeRef.value === "all" ? "*" : currentTypeRef.value}]`,
    actions,
    async onEdit(item: SymbolInfo) {
      await openEditor(pi, ctx, `${item.path}:${String(item.startLine)}`);
    },
    loadItems: (query: string) =>
      querySymbols(pi, ctx.cwd, query, currentTypeRef.value),
    filterItems: (items: SymbolInfo[], query: string): SymbolInfo[] =>
      items.filter((s) => s.name.toLowerCase().includes(query)),
    reloadDebounceMs: 300,
    formatItem: (item: SymbolInfo, _width: number, t: Theme): string =>
      formatSymbolListEntry(t, { ...item, line: item.startLine }),
    loadPreview: createFilePreviewLoader(ctx.cwd, theme),
    onKey: (data: string, onReload: (() => void) | undefined): boolean => {
      if (matchesKey(data, Key.ctrl("/"))) {
        const currentIndex = SYMBOL_TYPES.indexOf(currentTypeRef.value);
        const nextIndex = (currentIndex + 1) % SYMBOL_TYPES.length;
        currentTypeRef.value = SYMBOL_TYPES[nextIndex];
        onReload?.();
        return true;
      }
      return false;
    },
  };
}

export function createSymbolsComponent(
  options: SymbolsComponentOptions,
): ListPickerComponent & { invalidate: () => void } {
  const { pi, tui, theme, keybindings, done, initialQuery, ctx } = options;
  let pendingAction: SymbolReferenceActionType | undefined;
  let pendingInsertType: "name" | "path" | undefined;
  const currentTypeRef = { value: "class" as SymbolTypeFilter };

  function doneWithAction(item: SymbolInfo | null): void {
    if (!item) {
      done(null);
    } else if (pendingAction) {
      done({ symbol: item, action: pendingAction });
    } else if (pendingInsertType) {
      done({ symbol: item, insertType: pendingInsertType });
    } else {
      done({ symbol: item });
    }
    pendingAction = undefined;
    pendingInsertType = undefined;
  }

  const actions = buildSymbolActions(doneWithAction, (name) => {
    void goToFirstResult(pi, ctx, "types", [name]);
  });
  const pickerOptions = buildSymbolPickerOptions({
    pi,
    ctx,
    theme,
    currentTypeRef,
    actions,
  });

  const internalDone = (item: SymbolInfo | null) => {
    if (item) done({ symbol: item });
    else done(null);
  };

  return createListPicker<SymbolInfo>({
    pi,
    tui,
    theme,
    keybindings,
    done: internalDone,
    initialQuery,
    config: pickerOptions,
  });
}
