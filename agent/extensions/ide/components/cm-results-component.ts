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
import {
  formatSymbolListEntry,
  loadFilePreviewWithBat,
  applyFocusedStyle,
} from "./utils";

export interface CmResultItem extends ListPickerItem {
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
  signature?: string;
  callLine?: number;
}

export type CmActionType =
  | "callers"
  | "callees"
  | "tests"
  | "types"
  | "schema"
  | "impact"
  | "inspect"
  | "deps"
  | "used-by";

export interface CmResult {
  item: CmResultItem;
  action?: CmActionType;
}

interface CmResultsConfig {
  title: string;
  command: string;
  args: string[];
  cwd: string;
}

/** Codemapper command configurations */
interface CmCommandDef {
  titleFn: (target: string) => string;
  command: string;
  argsFn: (target: string) => string[];
}

/** All cm commands */
export const CM_COMMANDS: Record<CmActionType, CmCommandDef> = {
  callers: {
    titleFn: (s) => `Callers of ${s}`,
    command: "callers",
    argsFn: (s) => ["callers", s, "--limit", "100"],
  },
  callees: {
    titleFn: (s) => `Callees of ${s}`,
    command: "callees",
    argsFn: (s) => ["callees", s, "--limit", "100"],
  },
  tests: {
    titleFn: (s) => `Tests for ${s}`,
    command: "tests",
    argsFn: (s) => ["tests", s],
  },
  types: {
    titleFn: (s) => `Types for ${s}`,
    command: "types",
    argsFn: (s) => ["types", s],
  },
  schema: {
    titleFn: (s) => `Schema for ${s}`,
    command: "schema",
    argsFn: (s) => ["schema", s],
  },
  impact: {
    titleFn: (s) => `Impact of ${s}`,
    command: "impact",
    argsFn: (s) => ["impact", s, "--all"],
  },
  inspect: {
    titleFn: (f) => `Symbols in ${f}`,
    command: "inspect",
    argsFn: (f) => ["inspect", f],
  },
  deps: {
    titleFn: (f) => `Dependencies of ${f}`,
    command: "deps",
    argsFn: (f) => ["deps", f],
  },
  "used-by": {
    titleFn: (f) => `Used by ${f}`,
    command: "deps",
    argsFn: (f) => ["deps", f, "--direction", "used-by"],
  },
};

// Symbol-based actions available in cm results
const SYMBOL_ACTION_DEFS: [string, CmActionType][] = [
  ["ctrl+c", "callers"],
  ["ctrl+l", "callees"],
  ["ctrl+t", "tests"],
  ["ctrl+y", "types"],
  ["ctrl+s", "schema"],
  ["ctrl+i", "impact"],
];

/**
 * Parse cm output lines into structured items.
 * Extracts file path from [FILE:...] header if not in line format.
 */
function parseCmOutput(output: string): CmResultItem[] {
  // Extract file path from header for inspect command
  const fileMatch = /\[FILE:([^\]]+)\]/.exec(output);
  const headerFile = fileMatch?.[1];

  const lines = output.split("\n").filter((line) => {
    if (!line.trim()) return false;
    if (line.startsWith("[")) return false;
    if (line.startsWith("#")) return false;
    if (line.startsWith("-")) return false;
    if (line.startsWith("(")) return false;
    if (!line.includes("|")) return false;
    return true;
  });

  const items: CmResultItem[] = [];

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 3) continue;

    let name = parts[0].trim();
    const type = parts[1].trim();
    const locationPart = parts[2].trim();
    let signature: string | undefined;
    let callLine: number | undefined;

    for (let i = 3; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.startsWith("sig:")) {
        signature = part.slice(4);
      } else if (part.startsWith("call:")) {
        callLine = parseInt(part.slice(5), 10);
      }
    }

    if (locationPart.includes("<external>")) continue;

    let path: string;
    let startLine: number;
    let endLine: number;

    // Check if locationPart is a line-range (e.g., "71-172") vs path:line
    const lineRangeMatch = /^(\d+)-(\d+)$/.exec(locationPart);
    if (lineRangeMatch && headerFile) {
      // Inspect format: line-range only, use header file
      path = headerFile;
      startLine = parseInt(lineRangeMatch[1], 10);
      endLine = parseInt(lineRangeMatch[2], 10);
    } else if (locationPart.includes(":")) {
      // Standard format: path:line
      const colonIdx = locationPart.lastIndexOf(":");
      path = locationPart.slice(0, colonIdx);
      const parsedStartLine = parseInt(locationPart.slice(colonIdx + 1), 10);
      startLine = Number.isNaN(parsedStartLine) ? 1 : parsedStartLine;
      endLine = startLine;
    } else {
      // Fallback: treat as path
      path = locationPart;
      startLine = 1;
      endLine = 1;
    }

    if (/^\d+$/.test(name)) {
      const basename = path.split("/").pop() ?? path;
      name = basename.replace(/\.[^.]+$/, "");
    }

    items.push({
      id: `${path}:${String(startLine)}`,
      label: name,
      name,
      type,
      path,
      startLine,
      endLine,
      signature,
      callLine,
    });
  }

  return items;
}

export function createCmResultsComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: CmResult | null) => void,
  config: CmResultsConfig,
): ListPickerComponent & { invalidate: () => void } {
  let pendingAction: CmActionType | undefined;

  function doneWithAction(item: CmResultItem | null): void {
    if (item && pendingAction) {
      done({ item, action: pendingAction });
    } else if (item) {
      done({ item });
    } else {
      done(null);
    }
    pendingAction = undefined;
  }

  const actions: ListPickerAction<CmResultItem>[] = SYMBOL_ACTION_DEFS.map(
    ([key, action]) => ({
      key,
      label: action,
      handler: (item: CmResultItem) => {
        pendingAction = action;
        doneWithAction(item);
      },
    }),
  );

  const internalDone = (item: CmResultItem | null) => {
    if (item) {
      done({ item });
    } else {
      done(null);
    }
  };

  const picker = createListPicker<CmResultItem>(
    pi,
    tui,
    theme,
    keybindings,
    internalDone,
    "",
    {
      title: config.title,
      helpParts: ["↑↓ nav", "type to filter"],
      actions,
      onEdit: async (item) => {
        const { join } = await import("node:path");
        const line = item.callLine ?? item.startLine;
        await pi.exec("code", [
          "-g",
          `${join(config.cwd, item.path)}:${String(line)}`,
        ]);
      },
      loadItems: async () => {
        const result = await pi.exec("cm", [...config.args, "--format", "ai"], {
          cwd: config.cwd,
        });

        if (result.code !== 0) {
          throw new Error(`cm ${config.command} failed: ${result.stderr}`);
        }

        return parseCmOutput(result.stdout);
      },
      filterItems: (items, query) =>
        items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.path.toLowerCase().includes(query),
        ),
      formatItem: (item, _width, theme, isFocused) =>
        applyFocusedStyle(
          theme,
          formatSymbolListEntry(theme, {
            type: item.type,
            name: item.name,
            path: item.path,
            line: item.callLine ?? item.startLine,
            signature: item.signature,
          }),
          isFocused,
        ),
      loadPreview: (item) => loadFilePreviewWithBat(pi, item.path, config.cwd),
    },
  );

  return {
    ...picker,
    invalidate: () => {
      return;
    },
  };
}
