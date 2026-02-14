import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  createListPicker,
  type ListPickerItem,
  type ListPickerComponent,
} from "./list-picker";

interface FileInfo extends ListPickerItem {
  path: string;
}

export function createFilesComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: FileInfo | null) => void,
  initialQuery: string,
  cwd: string,
): ListPickerComponent & { invalidate: () => void } {
  const picker = createListPicker<FileInfo>(
    pi,
    tui,
    theme,
    keybindings,
    done,
    initialQuery,
    {
      title: "Files",
      helpParts: ["↑↓ nav", "type to search"],
      onEdit: async (item) => {
        await pi.exec("code", [item.path], { cwd });
      },
      loadItems: async () => {
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
      formatItem: (item) => item.path,
      loadPreview: async (item) => {
        const result = await pi.exec(
          "bat",
          ["--plain", "--color=always", item.path],
          { cwd },
        );
        if (result.code === 0) {
          return result.stdout.split("\n");
        }
        return [`Error reading file: ${result.stderr}`];
      },
    },
  );

  return {
    ...picker,
    invalidate: () => {
      // Trigger re-render by calling render with 0 width
    },
  };
}
