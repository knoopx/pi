/**
 * LSP Hook Extension for pi-coding-agent
 *
 * Provides automatic diagnostics feedback (default: agent end).
 * Can run after each write/edit or once per agent response.
 *
 * Usage:
 *   pi --extension ./lsp.ts
 *
 * Or load the directory to get both hook and tool:
 *   pi --extension ./lsp/
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import {
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Diagnostic } from "vscode-languageserver-protocol";
import { getOrCreateManager, shutdownManager } from "./core/manager";
import {
  LspParams,
  type LspParamsType,
  abortable,
  isAbortedError,
  cancelledToolResult,
  formatLocation,
  formatHover,
  formatSignature,
  collectSymbols,
  formatWorkspaceEdit,
  formatCodeActions,
} from "./core/utils";
import {
  formatDiagnostic,
  filterDiagnosticsBySeverity,
  type SeverityFilter,
  resolvePosition,
} from "./core/diagnostics";
import { typescriptServerConfig } from "./servers/typescript-server";
import { pyrightServerConfig } from "./servers/python-server";
import { marksmanServerConfig } from "./servers/marksman-server";
import { yamlServerConfig } from "./servers/yaml-server";
import { jsonServerConfig } from "./servers/json-server";

type HookMode = "edit_write" | "agent_end" | "disabled";

const DIAGNOSTICS_WAIT_MS_DEFAULT = 3000;
const DIAGNOSTICS_PREVIEW_LINES = 10;
const LSP_WORKing_MESSAGE = "LSP: Working...";
const DIM = "\x1b[2m",
  GREEN = "\x1b[32m",
  YELLOW = "\x1b[33m",
  RESET = "\x1b[0m";
const DEFAULT_HOOK_MODE: HookMode = "agent_end";
const SETTINGS_NAMESPACE = "lsp";

const WARMUP_MAP: Record<string, string> = {
  "package.json": ".ts",
  "pyproject.toml": ".py",
};

const MODE_LABELS: Record<HookMode, string> = {
  edit_write: "After each edit/write",
  agent_end: "At agent end",
  disabled: "Disabled",
};

function normalizeHookMode(value: unknown): HookMode | undefined {
  if (value === "edit_write" || value === "agent_end" || value === "disabled")
    return value;
  if (value === "turn_end") return "agent_end";
  return undefined;
}

export default function (pi: ExtensionAPI) {
  type LspActivity = "idle" | "loading" | "working";

  const activeClients: Set<string> = new Set();
  let statusUpdateFn: ((key: string, text: string | undefined) => void) | null =
    null;
  let hookMode: HookMode = DEFAULT_HOOK_MODE;
  let activity: LspActivity = "idle";
  let diagnosticsAbort: AbortController | null = null;
  let shuttingDown = false;
  let lspWorkingMessageActive = false;

  const touchedFiles: Map<string, boolean> = new Map();
  const globalSettingsPath = path.join(
    os.homedir(),
    ".pi",
    "agent",
    "settings.json",
  );

  function readSettingsFile(filePath: string): Record<string, unknown> {
    try {
      if (!fs.existsSync(filePath)) return {};
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as unknown as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  function getGlobalHookMode(): HookMode | undefined {
    const settings = readSettingsFile(globalSettingsPath);
    const lspSettings = settings[SETTINGS_NAMESPACE];
    const hookValue = (
      lspSettings as { hookMode?: unknown; hookEnabled?: unknown } | undefined
    )?.hookMode;
    const normalized = normalizeHookMode(hookValue);
    if (normalized) return normalized;

    const legacyEnabled = (lspSettings as { hookEnabled?: unknown } | undefined)
      ?.hookEnabled;
    if (typeof legacyEnabled === "boolean")
      return legacyEnabled ? "edit_write" : "disabled";
    return undefined;
  }

  function setGlobalHookMode(mode: HookMode): boolean {
    try {
      const settings = readSettingsFile(globalSettingsPath);
      const existing = settings[SETTINGS_NAMESPACE];
      const nextNamespace =
        existing && typeof existing === "object"
          ? {
              ...(existing as unknown as Record<string, unknown>),
              hookMode: mode,
            }
          : { hookMode: mode };

      settings[SETTINGS_NAMESPACE] = nextNamespace;
      fs.mkdirSync(path.dirname(globalSettingsPath), { recursive: true });
      fs.writeFileSync(
        globalSettingsPath,
        JSON.stringify(settings, null, 2),
        "utf-8",
      );
      return true;
    } catch {
      return false;
    }
  }

  function restoreHookState(_ctx: ExtensionContext): void {
    const globalSetting = getGlobalHookMode();
    hookMode = globalSetting ?? DEFAULT_HOOK_MODE;
  }

  function labelForMode(mode: HookMode): string {
    return MODE_LABELS[mode];
  }

  function messageContentToText(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((item) =>
          item &&
          typeof item === "object" &&
          "type" in item &&
          (item as unknown).type === "text"
            ? String((item as unknown).text ?? "")
            : "",
        )
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }

  function formatDiagnosticsForDisplay(text: string): string {
    return text
      .replace(/\n?This file has errors, please fix\n/gi, "\n")
      .replace(/<\/?file_diagnostics>\n?/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function setActivity(next: LspActivity): void {
    activity = next;
    updateLspStatus();
  }

  function showLspWorkingMessage(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    const ui = ctx.ui as { setWorkingMessage?: (text?: string) => void };
    if (!ui.setWorkingMessage) return;
    ui.setWorkingMessage(LSP_WORKing_MESSAGE);
    lspWorkingMessageActive = true;
  }

  function clearLspWorkingMessage(ctx: ExtensionContext): void {
    if (!lspWorkingMessageActive) return;
    lspWorkingMessageActive = false;
    if (!ctx.hasUI) return;
    const ui = ctx.ui as { setWorkingMessage?: (text?: string) => void };
    ui.setWorkingMessage?.();
  }

  function updateLspStatus(): void {
    if (!statusUpdateFn) return;

    const clients = activeClients.size > 0 ? [...activeClients].join(", ") : "";
    const clientsText = clients ? `${DIM}${clients}${RESET}` : "";
    const activityText =
      activity === "loading"
        ? `${DIM}Loading...${RESET}`
        : activity === "working"
          ? `${DIM}Working...${RESET}`
          : "";

    if (hookMode === "disabled") {
      const text = clientsText
        ? `${YELLOW}LSP${RESET} ${DIM}(tool)${RESET}: ${clientsText}`
        : `${YELLOW}LSP${RESET} ${DIM}(tool)${RESET}`;
      statusUpdateFn("lsp", text);
      return;
    }

    let text = `${GREEN}LSP${RESET}`;
    if (activityText) text += ` ${activityText}`;
    if (clientsText) text += ` ${clientsText}`;
    statusUpdateFn("lsp", text);
  }

  function normalizeFilePath(filePath: string, cwd: string): string {
    return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  }

  pi.registerMessageRenderer("lsp-diagnostics", (message, options, theme) => {
    const content = formatDiagnosticsForDisplay(
      messageContentToText(message.content),
    );
    if (!content) return new Text("", 0, 0);

    const expanded = options.expanded === true;
    const lines = content.split("\n");
    const maxLines = expanded ? lines.length : DIAGNOSTICS_PREVIEW_LINES;
    const display = lines.slice(0, maxLines);
    const remaining = lines.length - display.length;

    const styledLines = display.map((line) => {
      if (line.startsWith("File: ")) return theme.fg("muted", line);
      return theme.fg("toolOutput", line);
    });

    if (!expanded && remaining > 0) {
      styledLines.push(theme.fg("dim", `... (${remaining} more lines)`));
    }

    return new Text(styledLines.join("\n"), 0, 0);
  });

  function getServerConfig(filePath: string) {
    const ext = path.extname(filePath);
    const allServers = [
      typescriptServerConfig,
      pyrightServerConfig,
      marksmanServerConfig,
      yamlServerConfig,
      jsonServerConfig,
    ];
    return allServers.find((s) => s.extensions.includes(ext));
  }

  function ensureActiveClientForFile(
    filePath: string,
    cwd: string,
  ): string | undefined {
    const absPath = normalizeFilePath(filePath, cwd);
    const cfg = getServerConfig(absPath);
    if (!cfg) return undefined;

    if (!activeClients.has(cfg.id)) {
      activeClients.add(cfg.id);
      updateLspStatus();
    }

    return absPath;
  }

  function extractLspFiles(input: Record<string, unknown>): string[] {
    const files: string[] = [];

    if (typeof input.file === "string") files.push(input.file);
    if (Array.isArray(input.files)) {
      for (const item of input.files) {
        if (typeof item === "string") files.push(item);
      }
    }

    return files;
  }

  function buildDiagnosticsOutput(
    filePath: string,
    diagnostics: Diagnostic[],
    cwd: string,
    includeFileHeader: boolean,
  ): { notification: string; errorCount: number; output: string } {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(cwd, filePath);
    const relativePath = path.relative(cwd, absPath);
    const errorCount = diagnostics.filter((e) => e.severity === 1).length;

    const MAX = 5;
    const lines = diagnostics.slice(0, MAX).map((e) => {
      const sev = e.severity === 1 ? "ERROR" : "WARN";
      return `${sev}[${e.range.start.line + 1}] ${e.message.split("\n")[0]}`;
    });

    let notification = `${relativePath}\n${lines.join("\n")}`;
    if (diagnostics.length > MAX)
      notification += `\n... +${diagnostics.length - MAX} more`;

    const header = includeFileHeader ? `File: ${relativePath}\n` : "";
    const output = `\n${header}This file has errors, please fix\n<file_diagnostics>\n${diagnostics.map(formatDiagnostic).join("\n")}\n</file_diagnostics>\n`;

    return { notification, errorCount, output };
  }

  async function collectDiagnostics(
    filePath: string,
    ctx: ExtensionContext,
    includeWarnings: boolean,
    includeFileHeader: boolean,
    notify = true,
  ): Promise<string | undefined> {
    const manager = getOrCreateManager(ctx.cwd);
    const absPath = ensureActiveClientForFile(filePath, ctx.cwd);
    if (!absPath) return undefined;

    try {
      const result = await manager.touchFileAndWait(
        absPath,
        DIAGNOSTICS_WAIT_MS_DEFAULT,
      );
      if (!result.receivedResponse) return undefined;

      const diagnostics = includeWarnings
        ? result.diagnostics
        : result.diagnostics.filter((d) => d.severity === 1);
      if (!diagnostics.length) return undefined;

      const report = buildDiagnosticsOutput(
        filePath,
        diagnostics,
        ctx.cwd,
        includeFileHeader,
      );

      if (notify) {
        if (ctx.hasUI)
          ctx.ui.notify(
            report.notification,
            report.errorCount > 0 ? "error" : "warning",
          );
        else console.error(report.notification);
      }

      return report.output;
    } catch {
      return undefined;
    }
  }

  pi.registerCommand("lsp", {
    description: "LSP settings (auto diagnostics hook)",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("LSP settings require UI", "warning");
        return;
      }

      const currentMark = " ✓";
      const modeOptions = (
        ["edit_write", "agent_end", "disabled"] as HookMode[]
      ).map((mode) => ({
        mode,
        label:
          mode === hookMode
            ? `${labelForMode(mode)}${currentMark}`
            : labelForMode(mode),
      }));

      const modeChoice = await ctx.ui.select(
        "LSP auto diagnostics hook mode:",
        modeOptions.map((option) => option.label),
      );
      if (!modeChoice) return;

      const nextMode = modeOptions.find(
        (option) => option.label === modeChoice,
      )?.mode;
      if (!nextMode) return;

      const ok = setGlobalHookMode(nextMode);
      if (!ok) {
        ctx.ui.notify("Failed to update global settings", "error");
        return;
      }

      hookMode = nextMode;
      touchedFiles.clear();
      updateLspStatus();
      ctx.ui.notify(`LSP hook: ${labelForMode(hookMode)} (global)`, "info");
    },
  });

  pi.registerTool({
    name: "lsp",
    label: "LSP",
    description: `Query language server for definitions, references, types, symbols, diagnostics, rename, and code actions.

Actions: definition, references, hover, signature, rename (require file + line/column or query), symbols (file, optional query), diagnostics (file), workspace-diagnostics (files array), codeAction (file + position).
Use bash to find files: find src -name "*.ts" -type f`,
    parameters: LspParams,

    async execute(
      toolCallId: string,
      params: unknown,
      onUpdate: AgentToolUpdateCallback<Record<string, unknown>> | undefined,
      ctx: ExtensionContext,
      signal?: AbortSignal | undefined,
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      if (signal?.aborted) return cancelledToolResult();
      onUpdate?.({
        content: [{ type: "text", text: "Working..." }],
        details: { status: "working" },
      });

      const manager = getOrCreateManager(ctx.cwd);
      const {
        action,
        file,
        files,
        line,
        column,
        endLine,
        endColumn,
        query,
        newName,
        severity,
      } = params as LspParamsType;
      const sevFilter: SeverityFilter = (severity || "all") as SeverityFilter;
      const needsFile = action !== "workspace-diagnostics";
      const needsPos = [
        "definition",
        "references",
        "hover",
        "signature",
        "rename",
        "codeAction",
      ].includes(action);

      try {
        if (needsFile && !file)
          throw new Error(`Action "${action}" requires a file path.`);

        let rLine = line,
          rCol = column,
          fromQuery = false;
        if (
          needsPos &&
          (rLine === undefined || rCol === undefined) &&
          query &&
          file
        ) {
          const resolved = await abortable(
            resolvePosition(manager, file, query),
            signal,
          );
          if (resolved) {
            rLine = resolved.line;
            rCol = resolved.character;
            fromQuery = true;
          }
        }
        if (needsPos && (rLine === undefined || rCol === undefined)) {
          throw new Error(
            `Action "${action}" requires line/column or a query matching a symbol.`,
          );
        }

        const qLine = query ? `query: ${query}\n` : "";
        const sevLine = sevFilter !== "all" ? `severity: ${sevFilter}\n` : "";
        const posLine =
          fromQuery && rLine && rCol
            ? `resolvedPosition: ${rLine}:${rCol}\n`
            : "";

        switch (action) {
          case "definition": {
            const results = await abortable(
              manager.getDefinition(file!, rLine!, rCol!),
              signal,
            );
            const locs = results.map((l) => formatLocation(l, ctx?.cwd));
            const payload = locs.length
              ? locs.join("\n")
              : fromQuery
                ? `${file}:${rLine}:${rCol}`
                : "No definitions found.";
            return {
              content: [
                {
                  type: "text",
                  text: `action: definition\n${qLine}${posLine}${payload}`,
                },
              ],
              details: results as unknown as Record<string, unknown>,
            };
          }
          case "references": {
            const results = await abortable(
              manager.getReferences(file!, rLine!, rCol!),
              signal,
            );
            const locs = results.map((l) => formatLocation(l, ctx?.cwd));
            return {
              content: [
                {
                  type: "text",
                  text: `action: references\n${qLine}${posLine}${locs.length ? locs.join("\n") : "No references found."}`,
                },
              ],
              details: results as unknown as Record<string, unknown>,
            };
          }
          case "hover": {
            const result = await abortable(
              manager.getHover(file!, rLine!, rCol!),
              signal,
            );
            const payload = result
              ? formatHover(result.contents) || "No hover information."
              : "No hover information.";
            return {
              content: [
                {
                  type: "text",
                  text: `action: hover\n${qLine}${posLine}${payload}`,
                },
              ],
              details: (result as unknown as Record<string, unknown>) ?? null,
            };
          }
          case "symbols": {
            const symbols = await abortable(
              manager.getDocumentSymbols(file!),
              signal,
            );
            const lines = collectSymbols(symbols, 0, [], query);
            const payload = lines.length
              ? lines.join("\n")
              : query
                ? `No symbols matching "${query}".`
                : "No symbols found.";
            return {
              content: [
                { type: "text", text: `action: symbols\n${qLine}${payload}` },
              ],
              details: symbols as unknown as Record<string, unknown>,
            };
          }
          case "diagnostics": {
            const result = await abortable(
              manager.touchFileAndWait(file!, DIAGNOSTICS_WAIT_MS_DEFAULT),
              signal,
            );
            const filtered = filterDiagnosticsBySeverity(
              result.diagnostics,
              sevFilter,
            );
            const payload = (result as unknown).unsupported
              ? `Unsupported: ${(result as unknown).error || "No LSP for this file."}`
              : !result.receivedResponse
                ? "Timeout: LSP server did not respond. Try again."
                : filtered.length
                  ? filtered.map(formatDiagnostic).join("\n")
                  : "No diagnostics.";
            return {
              content: [
                {
                  type: "text",
                  text: `action: diagnostics\n${sevLine}${payload}`,
                },
              ],
              details: { ...result, diagnostics: filtered },
            };
          }
          case "workspace-diagnostics": {
            if (!files?.length)
              throw new Error(
                'Action "workspace-diagnostics" requires a "files" array.',
              );
            const waitMs = Math.max(
              ...files.map(() => DIAGNOSTICS_WAIT_MS_DEFAULT),
            );
            const result = await abortable(
              manager.getDiagnosticsForFiles(files, waitMs),
              signal,
            );
            const out: string[] = [];
            let errors = 0,
              warnings = 0,
              filesWithIssues = 0;

            for (const item of result.items) {
              const display =
                ctx?.cwd && path.isAbsolute(item.file)
                  ? path.relative(ctx.cwd, item.file)
                  : item.file;
              if (item.status !== "ok") {
                out.push(`${display}: ${item.error || item.status}`);
                continue;
              }
              const filtered = filterDiagnosticsBySeverity(
                item.diagnostics,
                sevFilter,
              );
              if (filtered.length) {
                filesWithIssues++;
                out.push(`${display}:`);
                for (const d of filtered) {
                  if (d.severity === 1) errors++;
                  else if (d.severity === 2) warnings++;
                  out.push(`  ${formatDiagnostic(d)}`);
                }
              }
            }

            const summary = `Analyzed ${result.items.length} file(s): ${errors} error(s), ${warnings} warning(s) in ${filesWithIssues} file(s)`;
            return {
              content: [
                {
                  type: "text",
                  text: `action: workspace-diagnostics\n${sevLine}${summary}\n\n${out.length ? out.join("\n") : "No diagnostics."}`,
                },
              ],
              details: result as unknown as Record<string, unknown>,
            };
          }
          case "signature": {
            const result = await abortable(
              manager.getSignatureHelp(file!, rLine!, rCol!),
              signal,
            );
            return {
              content: [
                {
                  type: "text",
                  text: `action: signature\n${qLine}${posLine}${formatSignature(result)}`,
                },
              ],
              details: (result as unknown as Record<string, unknown>) ?? null,
            };
          }
          case "rename": {
            if (!newName)
              throw new Error(
                'Action "rename" requires a "newName" parameter.',
              );
            const result = await abortable(
              manager.rename(file!, rLine!, rCol!, newName),
              signal,
            );
            if (!result)
              return {
                content: [
                  {
                    type: "text",
                    text: `action: rename\n${qLine}${posLine}No rename available at this position.`,
                  },
                ],
                details: null as unknown as Record<string, unknown>,
              };
            const edits = formatWorkspaceEdit(result, ctx?.cwd);
            return {
              content: [
                {
                  type: "text",
                  text: `action: rename\n${qLine}${posLine}newName: ${newName}\n\n${edits}`,
                },
              ],
              details: result,
            };
          }
          case "codeAction": {
            const result = await abortable(
              manager.getCodeActions(file!, rLine!, rCol!, endLine, endColumn),
              signal,
            );
            const actions = formatCodeActions(result);
            return {
              content: [
                {
                  type: "text",
                  text: `action: codeAction\n${qLine}${posLine}${actions.length ? actions.join("\n") : "No code actions available."}`,
                },
              ],
              details: result as unknown as Record<string, unknown>,
            };
          }
          default: {
            throw new Error(`Unknown action: ${action}`);
          }
        }
      } catch (e) {
        if (signal?.aborted || isAbortedError(e)) return cancelledToolResult();
        throw e;
      }
    },

    renderCall(_args, theme) {
      const params = _args as LspParamsType;
      let text =
        theme.fg("toolTitle", theme.bold("lsp ")) +
        theme.fg("accent", params.action || "...");
      if (params.file) text += " " + theme.fg("muted", params.file);
      else if (params.files?.length)
        text += " " + theme.fg("muted", `${params.files.length} file(s)`);
      if (params.query)
        text += " " + theme.fg("dim", `query="${params.query}"`);
      else if (params.line !== undefined && params.column !== undefined)
        text += theme.fg("warning", `:${params.line}:${params.column}`);
      if (params.severity && params.severity !== "all")
        text += " " + theme.fg("dim", `[${params.severity}]`);
      return new Text(text, 0, 0);
    },

    renderResult(result, options, theme) {
      if (options.isPartial)
        return new Text(theme.fg("warning", "Working..."), 0, 0);

      const textContent =
        (
          result.content?.find(
            (c: { type: string; text?: string }) => c.type === "text",
          ) as { type: string; text?: string } | undefined
        )?.text || "";
      const lines = textContent.split("\n");

      let headerEnd = 0;
      for (let i = 0; i < lines.length; i++) {
        if (/^(action|query|severity|resolvedPosition):/.test(lines[i]))
          headerEnd = i + 1;
        else break;
      }

      const header = lines.slice(0, headerEnd);
      const content = lines.slice(headerEnd);
      const maxLines = options.expanded
        ? content.length
        : DIAGNOSTICS_PREVIEW_LINES;
      const display = content.slice(0, maxLines);
      const remaining = content.length - maxLines;

      let out = header.map((l: string) => theme.fg("muted", l)).join("\n");
      if (display.length) {
        if (out) out += "\n";
        out += display.map((l: string) => theme.fg("toolOutput", l)).join("\n");
      }
      if (remaining > 0)
        out += theme.fg("dim", `\n... (${remaining} more lines)`);

      return new Text(out, 0, 0);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    restoreHookState(ctx);
    statusUpdateFn =
      ctx.hasUI && ctx.ui.setStatus ? ctx.ui.setStatus.bind(ctx.ui) : null;
    updateLspStatus();

    if (hookMode === "disabled") return;

    const manager = getOrCreateManager(ctx.cwd);

    for (const [marker, ext] of Object.entries(WARMUP_MAP)) {
      if (fs.existsSync(path.join(ctx.cwd, marker))) {
        setActivity("loading");
        manager
          .getClientsForFile(path.join(ctx.cwd, `dummy${ext}`))
          .then((clients) => {
            if (clients.length > 0) {
              const cfg = getServerConfig(path.join(ctx.cwd, `dummy${ext}`));
              if (cfg) activeClients.add(cfg.id);
            }
          })
          .catch(() => {})
          .finally(() => setActivity("idle"));
        break;
      }
    }
  });

  pi.on("session_switch", async (_event, ctx) => {
    restoreHookState(ctx);
    updateLspStatus();
  });

  pi.on("session_tree", async (_event, ctx) => {
    restoreHookState(ctx);
    updateLspStatus();
  });

  pi.on("session_fork", async (_event, ctx) => {
    restoreHookState(ctx);
    updateLspStatus();
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    diagnosticsAbort?.abort();
    diagnosticsAbort = null;
    setActivity("idle");

    await shutdownManager();
    activeClients.clear();
    statusUpdateFn?.("lsp", undefined);
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "lsp") return;
    const files = extractLspFiles(event.input);
    for (const file of files) {
      ensureActiveClientForFile(file, ctx.cwd);
    }
  });

  pi.on("agent_start", async (_event, ctx) => {
    diagnosticsAbort?.abort();
    diagnosticsAbort = null;
    clearLspWorkingMessage(ctx);
    setActivity("idle");
    touchedFiles.clear();
  });

  function agentWasAborted(event: unknown): boolean {
    const messages = Array.isArray(event?.messages) ? event.messages : [];
    return messages.some(
      (m: unknown) =>
        m &&
        typeof m === "object" &&
        "role" in m &&
        (m as { role: unknown }).role === "assistant" &&
        "stopReason" in m &&
        ((m as { stopReason: unknown }).stopReason === "aborted" ||
          (m as { stopReason: unknown }).stopReason === "error"),
    );
  }

  pi.on("agent_end", async (event, ctx) => {
    if (hookMode !== "agent_end") return;

    if (agentWasAborted(event)) {
      // Don't run diagnostics on aborted/error runs.
      touchedFiles.clear();
      return;
    }

    if (touchedFiles.size === 0) return;
    if (!ctx.isIdle() || ctx.hasPendingMessages()) return;

    const abort = new AbortController();
    diagnosticsAbort?.abort();
    diagnosticsAbort = abort;

    setActivity("working");
    showLspWorkingMessage(ctx);

    const files = Array.from(touchedFiles.entries());
    touchedFiles.clear();

    try {
      const outputs: string[] = [];
      for (const [filePath, includeWarnings] of files) {
        if (shuttingDown || abort.signal.aborted) return;
        if (!ctx.isIdle() || ctx.hasPendingMessages()) {
          abort.abort();
          return;
        }

        const output = await collectDiagnostics(
          filePath,
          ctx,
          includeWarnings,
          true,
          false,
        );
        if (abort.signal.aborted) return;
        if (output) outputs.push(output);
      }

      if (shuttingDown || abort.signal.aborted) return;

      if (outputs.length) {
        pi.sendMessage(
          {
            customType: "lsp-diagnostics",
            content: outputs.join("\n"),
            display: true,
          },
          {
            triggerTurn: true,
            deliverAs: "followUp",
          },
        );
      }
    } finally {
      if (diagnosticsAbort === abort) diagnosticsAbort = null;
      if (!shuttingDown) setActivity("idle");
      clearLspWorkingMessage(ctx);
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const filePath = event.input.path as string;
    if (!filePath) return;

    const absPath = ensureActiveClientForFile(filePath, ctx.cwd);
    if (!absPath) return;

    if (hookMode === "disabled") return;

    if (hookMode === "agent_end") {
      const includeWarnings = event.toolName === "write";
      const existing = touchedFiles.get(absPath) ?? false;
      touchedFiles.set(absPath, existing || includeWarnings);
      return;
    }

    const includeWarnings = event.toolName === "write";
    const output = await collectDiagnostics(
      absPath,
      ctx,
      includeWarnings,
      false,
    );
    if (!output) return;

    return {
      content: [
        ...event.content,
        { type: "text" as const, text: output },
      ] as Array<{ type: "text"; text: string }>,
    };
  });
}
