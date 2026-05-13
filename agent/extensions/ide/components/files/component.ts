import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { Key } from "@earendil-works/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
} from "../../lib/list-picker/picker";
import type { SymbolReferenceActionType } from "../symbol-references/types";
import { getFileIcon } from "../../lib/file-icons";
import { openEditor } from "../../lib/open-editor";
import type { FileInfo, FileResult } from "./types";
import { getMtimeSorter } from "./helpers";
import { loadPreviewFromPath } from "../../lib/file-preview";

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
  "cur",
  "tif",
  "tiff",
  "exr",
  "hdr",
  "pdf",
  "psd",
  "ai",
  "eps",
  "mp3",
  "ogg",
  "wav",
  "flac",
  "aac",
  "mp4",
  "avi",
  "mkv",
  "mov",
  "wmv",
  "webm",
  "zip",
  "tar",
  "gz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "o",
  "a",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "jpg",
  "jpeg",
]);

function isBinaryFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext !== undefined && BINARY_EXTENSIONS.has(ext);
}
interface FilesComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: FileResult | null) => void;
  initialQuery: string;
  ctx: ExtensionContext;
}
export function createFilesComponent(
  options: FilesComponentOptions,
): ListPickerComponent & Component {
  return new FilesView(options);
}

class FilesView implements Component {
  private picker: ListPickerComponent;
  private pendingAction: SymbolReferenceActionType | undefined;

  constructor(private options: FilesComponentOptions) {
    const { pi, tui, theme, keybindings, initialQuery, ctx } = this.options;
    this.picker = createListPicker<FileInfo>({
      pi,
      tui,
      theme,
      keybindings,
      done: (item: FileInfo | null) => {
        this.onPickerDone(item);
      },
      initialQuery,
      config: {
        title: () => "Files",
        formatItem: (item) => {
          return `${getFileIcon(item.path)} ${item.path}`;
        },
        loadPreview: (item: FileInfo) =>
          loadPreviewFromPath(ctx.cwd, item.path, theme),
        filterItems: (items, query) =>
          items.filter(
            (item) =>
              !isBinaryFile(item.path) &&
              item.path.toLowerCase().includes(query),
          ),

        async loadItems(_query: string) {
          const result = await pi.exec(
            "rg",
            ["--files", "--hidden", "-g", "!node_modules", "-g", "!.git"],
            { cwd: ctx.cwd },
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
            .sort(getMtimeSorter(ctx.cwd, statSync, join));
        },
        actions: [
          {
            key: Key.ctrl("i"),
            label: "insert",
            handler: (item) => {
              this.onPickerDone(item);
            },
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
        ],
        async onEdit(item) {
          await openEditor(pi, ctx, item.path);
        },
      },
    });
  }

  private onPickerDone = (item: FileInfo | null): void => {
    const doneCb = this.options.done;
    if (item && this.pendingAction) {
      doneCb({ file: item, action: this.pendingAction });
    } else if (item) {
      doneCb({ file: item });
    } else {
      doneCb(null);
    }
    this.pendingAction = undefined;
  };

  setPreview(_lines: string[]): void {}

  reload(): Promise<void> {
    this.invalidate();
    return Promise.resolve();
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
