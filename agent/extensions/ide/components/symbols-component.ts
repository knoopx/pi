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
import { loadFilePreviewWithBat, runCmCommand } from "./utils";

/** Symbol type icons */
const SYMBOL_TYPE_ICONS: Record<string, string> = {
  f: "ƒ", // function
  m: "○", // method
  c: "⬢", // class
  if: "◎", // interface
  ty: "τ", // type
  h: "#", // heading
  cb: "⟨⟩", // code block
  e: "≡", // enum
  v: "α", // variable
};

interface SymbolInfo extends ListPickerItem {
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
}

export function createSymbolsComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: SymbolInfo | null) => void,
  initialQuery: string,
  cwd: string,
): ListPickerComponent & { invalidate: () => void } {
  // Create actions that will be bound to the picker
  function createActions(
    picker: ListPickerComponent,
  ): ListPickerAction<SymbolInfo>[] {
    return [
      {
        key: "c",
        label: "callers",
        handler: async (item) => {
          await runCmCommand(pi, picker, cwd, "callers", [item.name]);
        },
      },
      {
        key: "C",
        label: "callees",
        handler: async (item) => {
          await runCmCommand(pi, picker, cwd, "callees", [item.name]);
        },
      },
      {
        key: "t",
        label: "tests",
        handler: async (item) => {
          await runCmCommand(pi, picker, cwd, "tests", [item.name]);
        },
      },
      {
        key: "T",
        label: "types",
        handler: async (item) => {
          await runCmCommand(pi, picker, cwd, "types", [item.name]);
        },
      },
      {
        key: "s",
        label: "schema",
        handler: async (item) => {
          await runCmCommand(pi, picker, cwd, "schema", [item.name]);
        },
      },
      {
        key: "i",
        label: "impact",
        handler: async (item) => {
          await runCmCommand(pi, picker, cwd, "impact", [item.name]);
        },
      },
    ];
  }

  // Create picker with placeholder actions, then update with real ones
  let pickerRef: ListPickerComponent | null = null;

  const picker = createListPicker<SymbolInfo>(
    pi,
    tui,
    theme,
    keybindings,
    done,
    initialQuery,
    {
      title: "Symbols",
      helpParts: ["↑↓ nav", "type to search"],
      get actions() {
        return pickerRef ? createActions(pickerRef) : [];
      },
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
      formatItem: (item) => {
        const icon = SYMBOL_TYPE_ICONS[item.type] || "•";
        const pathShort = item.path.replace(/^\.\//, "");
        return `${icon} ${item.name} ${pathShort}:${item.startLine}`;
      },
      loadPreview: (item) => loadFilePreviewWithBat(pi, item.path, cwd),
    },
  );

  pickerRef = picker;

  return {
    ...picker,
    invalidate: () => {
      // Trigger re-render
    },
  };
}
