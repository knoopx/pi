import { readFile } from "node:fs/promises";
import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
  type ListPickerAction,
} from "../../lib/list-picker";
import { formatSymbolListEntry } from "../../lib/symbol-utils";
import { loadFilePreviewWithShiki } from "../../lib/file-preview";
import type {
  SymbolReferenceItem,
  SymbolReferenceConfig,
  SymbolReferenceActionType,
  SymbolReferenceResult,
} from "./types";
import { parseSymbolReferenceOutput } from "./helpers";
import { openEditor } from "../../lib/editor-utils";
// Symbol-based actions available in symbol references
const SYMBOL_ACTION_DEFS: [string, SymbolReferenceActionType][] = [
  [Key.ctrl("t"), "callers"],
  [Key.ctrl("j"), "callees"],
  [Key.ctrl("y"), "types"],
  [Key.ctrl("k"), "schema"],
];

interface SymbolReferenceComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: SymbolReferenceResult | null) => void;
  config: SymbolReferenceConfig;
}

function buildSymbolActions(
  doneWithAction: (item: SymbolReferenceItem | null) => void,
): ListPickerAction<SymbolReferenceItem>[] {
  return [
    {
      key: Key.ctrl("i"),
      label: "insert",
      handler(item: SymbolReferenceItem) {
        doneWithAction(item);
      },
    },
    ...SYMBOL_ACTION_DEFS.map(([key, action]) => ({
      key,
      label: action,
      handler(item: SymbolReferenceItem) {
        doneWithAction(item);
      },
    })),
  ];
}

function buildSymbolPickerOptions(
  pi: ExtensionAPI,
  theme: Theme,
  config: SymbolReferenceConfig,
  actions: ListPickerAction<SymbolReferenceItem>[],
) {
  return {
    title: config.title,
    actions,
    async onEdit(item: SymbolReferenceItem) {
      const line = item.callLine ?? item.startLine;
      await openEditor(pi, config.ctx, `${item.path}:${String(line)}`);
    },
    async loadItems(_query: string) {
      const result = await pi.exec("cm", [...config.args, "--format", "ai"], {
        cwd: config.ctx.cwd,
      });
      if (result.code !== 0)
        throw new Error(`cm ${config.command} failed: ${result.stderr}`);
      return parseSymbolReferenceOutput(result.stdout);
    },
    filterItems: (
      items: SymbolReferenceItem[],
      query: string,
    ): SymbolReferenceItem[] =>
      items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.path.toLowerCase().includes(query),
      ),
    formatItem: (item: SymbolReferenceItem, width: number, t: Theme): string =>
      formatSymbolListEntry(t, {
        type: item.type,
        name: item.name,
        path: item.path,
        line: item.callLine ?? item.startLine,
        signature: item.signature,
      }),
    async loadPreview(item: SymbolReferenceItem) {
      try {
        const content = await readFile(item.path, "utf8");
        return loadFilePreviewWithShiki(item.path, content, theme);
      } catch (error) {
        return [
          `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        ];
      }
    },
  };
}

export function createSymbolReferenceComponent(
  options: SymbolReferenceComponentOptions,
): ListPickerComponent & { invalidate: () => void } {
  const { pi, tui, theme, keybindings, done, config } = options;
  let pendingAction: SymbolReferenceActionType | undefined;
  let pendingInsertType: "name" | "path" | undefined;

  function doneWithAction(item: SymbolReferenceItem | null): void {
    const result = resolveDoneResult(item, pendingAction, pendingInsertType);
    done(result);
    pendingAction = undefined;
    pendingInsertType = undefined;
  }

  function resolveDoneResult(
    item: SymbolReferenceItem | null,
    action: SymbolReferenceActionType | undefined,
    insertType: "name" | "path" | undefined,
  ): {
    item: SymbolReferenceItem;
    action?: SymbolReferenceActionType;
    insertType?: "name" | "path";
  } | null {
    if (!item) return null;
    if (action) return { item, action };
    if (insertType) return { item, insertType };
    return { item };
  }

  const actions = buildSymbolActions(doneWithAction);
  const pickerOptions = buildSymbolPickerOptions(pi, theme, config, actions);

  const internalDone = (item: SymbolReferenceItem | null) => {
    if (item) done({ item });
    else done(null);
  };

  return createListPicker<SymbolReferenceItem>({
    pi,
    tui,
    theme,
    keybindings,
    done: internalDone,
    initialQuery: "",
    config: pickerOptions,
  });
}
