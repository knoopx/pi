import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
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
): ListPickerComponent & Component {
  return new FilesView(pi, tui, theme, keybindings, done, initialQuery, cwd);
}

class FilesView implements Component {
  private picker: ListPickerComponent;
  private pendingAction: SymbolReferenceActionType | undefined;
  private selectedFiles = new Set<string>();
  private pi: ExtensionAPI;
  private done: (result: FileResult | null) => void;

  constructor(
    pi: ExtensionAPI,
    tui: { terminal: { rows: number }; requestRender: () => void },
    theme: Theme,
    keybindings: KeybindingsManager,
    done: (result: FileResult | null) => void,
    initialQuery: string,
    private cwd: string,
  ) {
    this.pi = pi;
    this.done = done;
    this.picker = createListPicker<FileInfo>(
      pi,
      tui,
      theme,
      keybindings,
      (item: FileInfo | null) => this.onPickerDone(item),
      initialQuery,
      {
        title: () => `Files (${this.selectedFiles.size} selected)`,
        formatItem: (item, width, theme) => {
          const isSelected = this.selectedFiles.has(item.path);
          const prefix = isSelected ? theme.fg("accent", "✓") : "";
          return `${prefix}${getFileIcon(item.path)} ${item.path}`;
        },
        loadPreview: createFilePreviewLoader(pi, cwd, theme),
        filterItems: (items, query) =>
          items.filter((item) => item.path.toLowerCase().includes(query)),
        async loadItems(query) {
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
        },
        actions: [
          {
            key: Key.ctrl("i"),
            label: "insert",
            handler: (item) => this.onPickerDone(item),
          },
          ...(
            [
              [Key.ctrl("t"), "inspect"] as const,
              [Key.ctrl("d"), "delete"] as const,
              [Key.ctrl("u"), "used-by"] as const,
            ] as const
          ).map(([key, action]) => ({
            key,
            label: action,
            handler: (item: FileInfo) => {
              this.pendingAction = action;
              this.onPickerDone(item);
            },
          })),
          {
            key: "space",
            label: "select",
            handler: () => {
              this.selectedFiles.clear();
              this.invalidate();
              tui.requestRender();
            },
          },
          {
            key: Key.ctrl("s"),
            label: "split",
            handler: (item) => void this.splitFile(item, cwd),
          },
        ],
        async onEdit(item) {
          await pi.exec("editor", [item.path], { cwd });
        },
      },
    );
  }

  private onPickerDone = (item: FileInfo | null): void => {
    const doneCb = this.done;
    if (item && this.pendingAction) {
      doneCb({ file: item, action: this.pendingAction });
    } else if (item) {
      doneCb({ file: item });
    } else {
      doneCb(null);
    }
    this.pendingAction = undefined;
  };

  private async splitFile(item: FileInfo | null, cwd: string): Promise<void> {
    const filesToSplit =
      this.selectedFiles.size > 0
        ? [...this.selectedFiles]
        : item
          ? [item.path]
          : [];

    if (filesToSplit.length === 0) {
      this.picker.notify?.("No files selected", "error");
      return;
    }

    try {
      const splitResult = await this.pi.exec(
        "jj",
        ["split", "-m", "", "--", ...filesToSplit],
        { cwd },
      );
      this.selectedFiles.clear();
      const msg = `Split selected files (${filesToSplit.length}): ${filesToSplit.join(", ")}`;
      this.picker.notify?.(msg, "info");
      notifyMutation(this.pi, msg, splitResult.stderr || splitResult.stdout);
    } catch (error) {
      this.picker.notify?.(
        `Failed to split: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  setPreview(_lines: string[]): void {
    // Not applicable for file browser
  }

  async reload(): Promise<void> {
    this.invalidate();
  }

  render(width: number): string[] {
    return this.picker.render(width);
  }
  handleInput(data: string): void {
    this.picker.handleInput(data);
  }
  invalidate(): void {
    this.picker.invalidate();
  }
  dispose(): void {
    this.picker.dispose();
  }
}
