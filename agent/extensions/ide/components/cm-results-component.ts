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
import { loadFilePreviewWithBat, SYMBOL_TYPE_ICONS } from "./utils";

interface CmResultItem extends ListPickerItem {
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
  signature?: string;
  callLine?: number;
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

/** Symbol-based cm commands (callers, callees, tests, types, schema, impact) */
const SYMBOL_COMMANDS: Record<string, CmCommandDef> = {
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
};

/** File-based cm commands (inspect, deps, used-by) */
const FILE_COMMANDS: Record<string, CmCommandDef> = {
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

/**
 * Parse cm output lines into structured items
 * Handles formats:
 * - name|type|path|line-range (query format)
 * - name|type|path:line (callers/callees format)
 * - name|type|path:line|sig:signature (callees with signature)
 * - name|type|path:line|call:callLine (tests format)
 * - number|type|path:line (impact matches)
 */
function parseCmOutput(output: string): CmResultItem[] {
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

    let name = parts[0]!.trim();
    const type = parts[1]!.trim();
    const locationPart = parts[2]!.trim();
    let signature: string | undefined;
    let callLine: number | undefined;

    for (let i = 3; i < parts.length; i++) {
      const part = parts[i]!.trim();
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

    if (locationPart.includes(":")) {
      const colonIdx = locationPart.lastIndexOf(":");
      path = locationPart.slice(0, colonIdx);
      startLine = parseInt(locationPart.slice(colonIdx + 1), 10) || 1;
      endLine = startLine;
    } else {
      path = locationPart;
      startLine = 1;
      endLine = 1;
    }

    if (/^\d+$/.test(name)) {
      const basename = path.split("/").pop() || path;
      name = basename.replace(/\.[^.]+$/, "");
    }

    items.push({
      id: `${path}:${startLine}`,
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

function createCmResultsComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: CmResultItem | null) => void,
  config: CmResultsConfig,
): ListPickerComponent & { invalidate: () => void } {
  const picker = createListPicker<CmResultItem>(
    pi,
    tui,
    theme,
    keybindings,
    done,
    "",
    {
      title: config.title,
      helpParts: ["↑↓ nav", "type to filter"],
      onEdit: async (item) => {
        const { join } = await import("node:path");
        const line = item.callLine || item.startLine;
        await pi.exec("code", ["-g", `${join(config.cwd, item.path)}:${line}`]);
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
      formatItem: (item) => {
        const icon = SYMBOL_TYPE_ICONS[item.type] || "•";
        const pathShort = item.path.replace(/^\.\//, "");
        const line = item.callLine || item.startLine;
        const sig = item.signature ? ` ${item.signature}` : "";
        return `${icon} ${item.name}${sig} ${pathShort}:${line}`;
      },
      loadPreview: (item) => loadFilePreviewWithBat(pi, item.path, config.cwd),
    },
  );

  return { ...picker, invalidate: () => {} };
}

/** Common parameters for cm opener functions */
type CmOpenerParams = [
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: CmResultItem | null) => void,
  target: string,
  cwd: string,
];

/** Factory to create cm opener functions from command definitions */
function createCmOpener(def: CmCommandDef) {
  return (
    ...[pi, tui, theme, keybindings, done, target, cwd]: CmOpenerParams
  ) =>
    createCmResultsComponent(pi, tui, theme, keybindings, done, {
      title: def.titleFn(target),
      command: def.command,
      args: def.argsFn(target),
      cwd,
    });
}

// Symbol-based openers
export const openCmCallers = createCmOpener(SYMBOL_COMMANDS.callers!);
export const openCmCallees = createCmOpener(SYMBOL_COMMANDS.callees!);
export const openCmTests = createCmOpener(SYMBOL_COMMANDS.tests!);
export const openCmTypes = createCmOpener(SYMBOL_COMMANDS.types!);
export const openCmSchema = createCmOpener(SYMBOL_COMMANDS.schema!);
export const openCmImpact = createCmOpener(SYMBOL_COMMANDS.impact!);

// File-based openers
export const openCmInspect = createCmOpener(FILE_COMMANDS.inspect!);
export const openCmDeps = createCmOpener(FILE_COMMANDS.deps!);
export const openCmUsedBy = createCmOpener(FILE_COMMANDS["used-by"]!);
