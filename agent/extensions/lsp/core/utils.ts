/**
 * LSP Core - Utility Functions
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Type, type Static } from "@sinclair/typebox";
import { Diagnostic } from "vscode-languageserver-protocol";
import { fileURLToPath } from "url";
import {
  uriToPath,
  findSymbolPosition,
  resolvePosition,
} from "./diagnostics.js";

if (!(globalThis as unknown).fs) {
  (globalThis as unknown).fs = fs;
}

export { spawn, ChildProcessWithoutNullStreams };

// Search Paths for finding executables
function getSearchPaths(): string[] {
  const currentPaths = process.env.PATH?.split(path.delimiter) || [];
  return [
    ...currentPaths,
    "/usr/local/bin",
    "/opt/homebrew/bin",
    `${process.env.HOME}/.pub-cache/bin`,
    `${process.env.HOME}/fvm/default/bin`,
    `${process.env.HOME}/go/bin`,
    `${process.env.HOME}/.cargo/bin`,
    "/etc/profiles/per-user/knoopx/bin",
  ];
}

/**
 * Find an executable in the search paths
 */
export function which(cmd: string): string | undefined {
  const ext = process.platform === "win32" ? ".exe" : "";

  // If absolute path provided, check if it exists
  const globalFs = (globalThis as unknown).fs;
  const exists = (p: string) =>
    (globalFs?.existsSync?.(p) ?? false) || fs.existsSync(p);
  const stat = (p: string) => globalFs?.statSync?.(p) ?? fs.statSync(p);

  if (cmd.startsWith("/") || cmd.startsWith("./") || cmd.startsWith("../")) {
    const fullPath = path.resolve(cmd) + ext;
    try {
      if (exists(fullPath) && stat(fullPath).isFile()) {
        return fullPath;
      }
    } catch {}
    return undefined;
  }

  const searchPaths = getSearchPaths();

  for (const dir of searchPaths) {
    const full = path.join(dir, cmd + ext);
    try {
      if (exists(full) && stat(full).isFile()) return full;
    } catch {}
  }
}

/**
 * LSP Tool Helper Functions
 */

export const ACTIONS = [
  "definition",
  "references",
  "hover",
  "symbols",
  "diagnostics",
  "workspace-diagnostics",
  "signature",
  "rename",
  "codeAction",
];

export const SEVERITY_FILTERs = [
  "all",
  "error",
  "warning",
  "info",
  "hint",
] as const;

export const LspParams = Type.Object({
  action: Type.Union(
    ACTIONS.map((a) => Type.Literal(a)),
    { description: "LSP action to perform" },
  ),
  file: Type.Optional(
    Type.String({ description: "File path for single-file actions" }),
  ),
  files: Type.Optional(
    Type.Array(Type.String(), {
      description: "Array of file paths for workspace actions",
    }),
  ),
  line: Type.Optional(Type.Number({ description: "Line number (1-based)" })),
  column: Type.Optional(
    Type.Number({ description: "Column number (1-based)" }),
  ),
  endLine: Type.Optional(
    Type.Number({ description: "End line number for ranges" }),
  ),
  endColumn: Type.Optional(
    Type.Number({ description: "End column number for ranges" }),
  ),
  query: Type.Optional(
    Type.String({
      description: "Query string for symbol search or position resolution",
    }),
  ),
  newName: Type.Optional(
    Type.String({ description: "New name for rename action" }),
  ),
  severity: Type.Optional(
    Type.Union(
      SEVERITY_FILTERs.map((s) => Type.Literal(s)),
      { description: "Severity filter for diagnostics" },
    ),
  ),
});

export type LspParamsType = Static<typeof LspParams>;

export function abortable<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error("aborted"));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new Error("aborted"));
    };

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (err) => {
        cleanup();
        reject(err);
      },
    );
  });
}

export function isAbortedError(e: unknown): boolean {
  return e instanceof Error && e.message === "aborted";
}

export function cancelledToolResult() {
  return {
    content: [{ type: "text" as const, text: "Cancelled" }],
    details: { cancelled: true },
  };
}

export function formatLocation(
  loc: { uri: string; range?: { start?: { line: number; character: number } } },
  cwd?: string,
): string {
  const abs = uriToPath(loc.uri);
  const display = cwd && path.isAbsolute(abs) ? path.relative(cwd, abs) : abs;
  const { line, character: col } = loc.range?.start ?? {};
  return typeof line === "number" && typeof col === "number"
    ? `${display}:${line + 1}:${col + 1}`
    : display;
}

export function formatHover(contents: unknown): string {
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents))
    return contents
      .map((c) => {
        if (typeof c === "string") return c;
        // Only process items with type: "text" or type: "value"
        const type = (c as unknown)?.type;
        if (type === "text") {
          return (c as unknown)?.text ?? "";
        }
        if (type === "value") {
          return (c as unknown)?.value ?? (c as unknown)?.text ?? "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  if (contents && typeof contents === "object" && "value" in contents)
    return String((contents as unknown).value);
  return "";
}

export function formatSignature(help: unknown): string {
  if (!help?.signatures?.length) return "No signature help available.";
  const sig = help.signatures[help.activeSignature ?? 0] ?? help.signatures[0];
  let text = sig.label ?? "Signature";
  if (sig.documentation)
    text += `\n${typeof sig.documentation === "string" ? sig.documentation : (sig.documentation?.value ?? "")}`;
  if (sig.parameters?.length) {
    const params = sig.parameters
      .map((p: unknown) =>
        typeof p.label === "string"
          ? p.label
          : Array.isArray(p.label)
            ? p.label.join("-")
            : "",
      )
      .filter(Boolean);
    if (params.length) text += `\nParameters: ${params.join(", ")}`;
  }
  return text;
}

export function collectSymbols(
  symbols: unknown[],
  depth = 0,
  lines: string[] = [],
  query?: string,
): string[] {
  for (const sym of symbols) {
    const name = sym?.name ?? "<unknown>";
    if (query && !name.toLowerCase().includes(query.toLowerCase())) {
      if (sym.children?.length)
        collectSymbols(sym.children, depth + 1, lines, query);
      continue;
    }
    const loc = sym?.range?.start
      ? `${sym.range.start.line + 1}:${sym.range.start.character + 1}`
      : "";
    lines.push(`${"  ".repeat(depth)}${name}${loc ? ` (${loc})` : ""}`);
    if (sym.children?.length)
      collectSymbols(sym.children, depth + 1, lines, query);
  }
  return lines;
}

/**
 * Helper function to process edits from a workspace edit
 */
function processWorkspaceEdits(
  lines: string[],
  cwd?: string,
  edits?: Array<{
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    newText: string;
  }>,
  uri?: string,
): void {
  if (!edits?.length) return;

  const fp = uri ? uriToPath(uri) : "";
  const display = cwd && path.isAbsolute(fp) ? path.relative(cwd, fp) : fp;
  lines.push(`${display}:`);

  for (const e of edits) {
    const loc = `${e.range.start.line + 1}:${e.range.start.character + 1}`;
    lines.push(`  [${loc}] → "${e.newText}"`);
  }
}

export function formatWorkspaceEdit(edit: unknown, cwd?: string): string {
  const lines: string[] = [];

  if (edit.documentChanges?.length) {
    for (const change of edit.documentChanges) {
      if (change.textDocument?.uri) {
        processWorkspaceEdits(
          lines,
          cwd,
          change.edits,
          change.textDocument.uri,
        );
      }
    }
  }

  if (edit.changes) {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      processWorkspaceEdits(lines, cwd, edits as unknown[], uri);
    }
  }

  return lines.length ? lines.join("\n") : "No edits.";
}

export function formatCodeActions(actions: unknown[]): string[] {
  return actions.map((a, i) => {
    const title = a.title || a.command?.title || "Untitled action";
    const kind = a.kind ? ` (${a.kind})` : "";
    const isPreferred = a.isPreferred ? " ★" : "";
    return `${i + 1}. ${title}${kind}${isPreferred}`;
  });
}

/**
 * Normalize file system path
 */
export function normalizeFsPath(p: string): string {
  if (path.isAbsolute(p)) {
    return p;
  }
  if (p.includes("../") || p.includes("./")) {
    return path.resolve(p);
  }
  return p;
}

/**
 * Find the nearest file in a directory tree
 */
export function findNearestFile(
  startDir: string,
  targets: string[],
  stopDir: string,
): string | undefined {
  let current = path.resolve(startDir);
  const stop = path.resolve(stopDir);
  while (current.length >= stop.length) {
    for (const t of targets) {
      const candidate = path.join(current, t);
      // Try global fs first (for memfs support in tests), then module fs
      const globalFs = (globalThis as unknown).fs;
      if (globalFs && globalFs.existsSync && globalFs.existsSync(candidate)) {
        return candidate;
      }
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

/**
 * Find project root using marker files
 */
export function findRoot(
  file: string,
  cwd: string,
  markers: string[],
): string | undefined {
  const startDir = path.dirname(file);
  const found = findNearestFile(startDir, markers, cwd);
  if (found) return path.dirname(found);
  const root = path.parse(startDir).root;
  const fallback = findNearestFile(startDir, markers, root);
  return fallback ? path.dirname(fallback) : undefined;
}

/**
 * Timeout wrapper for promises
 */
export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  name: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${name} timed out`)), ms);
    promise.then(
      (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Simple spawn wrapper for language servers
 */
export function spawnSimpleLanguageServer(
  bin: string,
  args: string[],
): (
  root: string,
) => Promise<{ process: ChildProcessWithoutNullStreams } | undefined> {
  return async (root: string) => {
    const cmd = which(bin);
    if (!cmd) return undefined;
    try {
      const child = spawn(cmd, args, {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { process: child };
    } catch {
      return undefined;
    }
  };
}

/**
 * Spawn a process and check if it exits immediately (unsupported flag)
 */
export async function spawnChecked(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<ChildProcessWithoutNullStreams | undefined> {
  try {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });

    // If the process exits immediately (e.g. unsupported flag), treat it as a failure
    return await new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        child.removeListener("exit", onExit);
        child.removeListener("error", onError);
      };

      let timer: NodeJS.Timeout | null = null;

      const finish = (value: ChildProcessWithoutNullStreams | undefined) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        cleanup();
        resolve(value);
      };

      const onExit = () => finish(undefined);
      const onError = () => finish(undefined);

      child.once("exit", onExit);
      child.once("error", onError);

      timer = setTimeout(() => finish(child), 200);
      (timer as unknown).unref?.();
    });
  } catch {
    return undefined;
  }
}

/**
 * Spawn with multiple argument variants (fallback)
 */
export async function spawnWithFallback(
  cmd: string,
  argsVariants: string[][],
  cwd: string,
): Promise<ChildProcessWithoutNullStreams | undefined> {
  for (const args of argsVariants) {
    const child = await spawnChecked(cmd, args, cwd);
    if (child) return child;
  }
  return undefined;
}

/**
 * Run a command and return success status
 */
export async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<boolean> {
  return await new Promise((resolve) => {
    try {
      const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
      p.on("error", () => resolve(false));
      p.on("exit", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}
