import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerItem,
  type ListPickerComponent,
  type ListPickerAction,
} from "./list-picker";
import type { SymbolReferenceActionType } from "./symbol-references";
import { createFilePreviewLoader } from "./preview-utils";
import { getFileIcon } from "./file-icons";
import { notifyMutation } from "../jj";
import type { StatSyncFn } from "node:fs";

function getMtimeSorter(
  cwd: string,
  statSync: StatSyncFn,
  join: (a: string, b: string) => string,
) {
  return (a: FileInfo, b: FileInfo) => {
    let mtimeA = 0;
    let mtimeB = 0;
    try {
      mtimeA = statSync(join(cwd, a.path)).mtimeMs;
    } catch {
      /* use default */
    }
    try {
      mtimeB = statSync(join(cwd, b.path)).mtimeMs;
    } catch {
      /* use default */
    }
    return mtimeB - mtimeA;
  };
}

interface FileInfo extends ListPickerItem {
  path: string;
}

export interface FileResult {
  file: FileInfo;
  action?: SymbolReferenceActionType;
}

export function createFilesComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: FileResult | null) => void,
  initialQuery: string,
  cwd: string,
): ListPickerComponent & { invalidate: () => void } {
  // Track pending action for when an action key is pressed
  let pendingAction: SymbolReferenceActionType | undefined;

  // Multi-selection state
  const selectedFiles = new Set<string>();

  // Wrapper to close picker with action metadata
  function doneWithAction(item: FileInfo | null): void {
    if (item && pendingAction) done({ file: item, action: pendingAction });
    else if (item) done({ file: item });
    else {
      done(null);
    }
    pendingAction = undefined;
  }

  // Action definitions: [key, label/action]
  const ACTION_DEFS: [string, SymbolReferenceActionType][] = [
    [Key.ctrl("t"), "inspect"],
    [Key.ctrl("d"), "delete"],
    [Key.ctrl("u"), "used-by"],
  ];
  const internalDone = (item: FileInfo | null) => {
    if (item) done({ file: item });
    else {
      done(null);
    }
  };
  const splitFiles = async (
    focusedItem: FileInfo | null,
    notify?: (msg: string, type?: "info" | "error") => void,
  ) => {
    const filesToSplit =
      selectedFiles.size > 0
        ? [...selectedFiles]
        : focusedItem
          ? [focusedItem.path]
          : [];

    if (filesToSplit.length === 0) {
      notify?.("No files selected", "error");
      return;
    }

    try {
      const splitResult = await pi.exec(
        "jj",
        ["split", "-m", "", "--", ...filesToSplit],
        { cwd },
      );
      selectedFiles.clear();
      const msg = `Split selected files (${filesToSplit.length}): ${filesToSplit.join(", ")}`;
      notify?.(msg, "info");
      notifyMutation(pi, msg, splitResult.stderr || splitResult.stdout);
    } catch (error) {
      notify?.(
        `Failed to split: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  };

  const actions: ListPickerAction<FileInfo>[] = [
    {
      key: Key.ctrl("i"),
      label: "insert",
      handler(item: FileInfo) {
        internalDone(item);
      },
    },
    ...ACTION_DEFS.map(([key, action]) => ({
      key,
      label: action,
      handler(item: FileInfo) {
        pendingAction = action;
        doneWithAction(item);
      },
    })),
  ];

  let pickerInstance: ListPickerComponent | null = null;

  const handleSelect = (item: FileInfo) => {
    if (selectedFiles.has(item.path)) selectedFiles.delete(item.path);
    else selectedFiles.add(item.path);
  };

  const loadItemsWithMtime = async (_query: string): Promise<FileInfo[]> => {
    const result = await pi.exec(
      "rg",
      ["--files", "--hidden", "-g", "!node_modules", "-g", "!.git"],
      { cwd },
    );

    if (result.code !== 0)
      throw new Error(`Failed to load files: ${result.stderr}`);

    const { statSync } = await import("node:fs");
    const { join } = await import("node:path");

    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((path) => ({ id: path, label: path, path }))
      .sort(getMtimeSorter(cwd, statSync, join));
  };

  const picker = createListPicker<FileInfo>(
    pi,
    tui,
    theme,
    keybindings,
    internalDone,
    initialQuery,
    {
      title: () =>
        selectedFiles.size > 0
          ? `Files (${selectedFiles.size} selected)`
          : "Files",
      actions: [
        ...actions,
        {
          key: "space",
          label: "select",
          handler(item) {
            handleSelect(item);
            picker.invalidate();
            tui.requestRender();
          },
        },
        {
          key: Key.ctrl("s"),
          label: "split",
          handler(item) {
            void splitFiles(item, pickerInstance?.notify);
          },
        },
      ],
      async onEdit(item) {
        await pi.exec("editor", [item.path], { cwd });
      },
      loadItems: loadItemsWithMtime,
      filterItems: (items, query) =>
        items.filter((item) => item.path.toLowerCase().includes(query)),
      formatItem(item, width, theme) {
        const isSelected = selectedFiles.has(item.path);
        const marker = isSelected ? theme.fg("accent", "✓ ") : "  ";
        return `${marker}${getFileIcon(item.path)} ${item.path}`;
      },
      loadPreview: createFilePreviewLoader(pi, cwd, theme),
    },
  );

  pickerInstance = picker;

  return {
    ...picker,
    invalidate() {
      picker.invalidate();
    },
  };
}
