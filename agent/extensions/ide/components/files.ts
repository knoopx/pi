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
import { loadFilePreviewWithBat } from "./file-preview";
import { getFileIcon } from "./file-icons";
import { applyFocusedStyle } from "./style-utils";
import type { CmActionType } from "./cm-results";

export interface FileInfo extends ListPickerItem {
  path: string;
}

export interface FileResult {
  file: FileInfo;
  action?: CmActionType;
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
  let pendingAction: CmActionType | undefined;

  // Wrapper to close picker with action metadata
  function doneWithAction(item: FileInfo | null): void {
    if (item && pendingAction) {
      done({ file: item, action: pendingAction });
    } else if (item) {
      done({ file: item });
    } else {
      done(null);
    }
    pendingAction = undefined;
  }

  // Action definitions: [key, label/action]
  const ACTION_DEFS: [string, CmActionType][] = [
    ["ctrl+i", "inspect"],
    ["ctrl+d", "deps"],
    ["ctrl+u", "used-by"],
  ];

  const actions: ListPickerAction<FileInfo>[] = ACTION_DEFS.map(
    ([key, action]) => ({
      key,
      label: action,
      handler: (item: FileInfo) => {
        pendingAction = action;
        doneWithAction(item);
      },
    }),
  );

  // Internal done handler that wraps results
  const internalDone = (item: FileInfo | null) => {
    if (item) {
      done({ file: item });
    } else {
      done(null);
    }
  };

  const picker = createListPicker<FileInfo>(
    pi,
    tui,
    theme,
    keybindings,
    internalDone,
    initialQuery,
    {
      title: "Files",
      actions,
      onEdit: async (item) => {
        await pi.exec("code", [item.path], { cwd });
      },
      loadItems: async (_query) => {
        const result = await pi.exec(
          "rg",
          ["--files", "--hidden", "-g", "!node_modules", "-g", "!.git"],
          { cwd },
        );

        if (result.code !== 0) {
          throw new Error(`Failed to load files: ${result.stderr}`);
        }

        const { statSync } = await import("node:fs");
        const { join } = await import("node:path");

        const parsedFiles = result.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((path) => ({ id: path, label: path, path }));

        return parsedFiles.sort((a, b) => {
          let mtimeA = 0;
          let mtimeB = 0;

          try {
            mtimeA = statSync(join(cwd, a.path)).mtimeMs;
          } catch {
            mtimeA = 0;
          }

          try {
            mtimeB = statSync(join(cwd, b.path)).mtimeMs;
          } catch {
            mtimeB = 0;
          }

          return mtimeB - mtimeA;
        });
      },
      filterItems: (items, query) =>
        items.filter((item) => item.path.toLowerCase().includes(query)),
      formatItem: (item, _width, theme, isFocused) =>
        applyFocusedStyle(
          theme,
          `${getFileIcon(item.path)} ${item.path}`,
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
