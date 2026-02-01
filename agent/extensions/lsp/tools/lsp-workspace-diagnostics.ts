/**
 * LSP Workspace Diagnostics Tool
 *
 * Get diagnostics for multiple files in workspace
 */

import type {
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import {
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import * as Type from "@sinclair/typebox";
import * as path from "node:path";
import { getOrCreateManager } from "../core/manager";
import { type LspParamsType, cancelledToolResult } from "../core/utils";
import { filterDiagnosticsBySeverity } from "../core/diagnostics";
import { formatDiagnostic } from "../core/diagnostics";

const DIAGNOSTICS_WAIT_MS_DEFAULT = 3000;

/**
 * LSP Workspace Diagnostics Tool
 */
export function lspWorkspaceDiagnosticsTool(api: ExtensionAPI) {
  return api.registerTool({
    name: "lsp-workspace-diagnostics",
    label: "Workspace Diagnostics",
    description: "Get diagnostics for multiple files in workspace",
    parameters: Type.Object({
      files: Type.Array(Type.String({ description: "Array of file paths" }), {
        description: "Array of file paths to analyze",
      }),
      severity: Type.Optional(
        Type.Union(
          ["all", "error", "warning", "info", "hint"].map((s) =>
            Type.Literal(s),
          ),
          { description: "Severity filter for diagnostics" },
        ),
      ),
    }),

    async execute(
      toolCallId: string,
      params: unknown,
      onUpdate: AgentToolUpdateCallback<Record<string, unknown>> | undefined,
      ctx: ExtensionContext,
      signal?: AbortSignal | undefined,
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      if (signal?.aborted) return cancelledToolResult();
      if (typeof onUpdate === "function") {
        onUpdate({
          content: [{ type: "text", text: "Working..." }],
          details: { status: "working" },
        });
      }

      const manager = getOrCreateManager(ctx.cwd);
      const { files, severity } = params as LspParamsType;
      if (!files?.length)
        throw new Error(
          'Action "workspace-diagnostics" requires a "files" array.',
        );
      const sevFilter = severity || "all";

      const waitMs = Math.max(...files.map(() => DIAGNOSTICS_WAIT_MS_DEFAULT));
      const result = await manager.getDiagnosticsForFiles(
        files,
        waitMs,
        signal,
      );
      if (signal?.aborted) return cancelledToolResult();

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

          // Read file content to include source lines in diagnostics
          let fileContent: string | undefined;
          try {
            const content = manager.readFile(manager.resolve(item.file));
            if (content !== null) {
              fileContent = content;
            }
          } catch {
            // If we can't read the file, proceed without source lines
          }

          for (const d of filtered) {
            if (d.severity === 1) errors++;
            else if (d.severity === 2) warnings++;
            out.push(`  ${formatDiagnostic(d, fileContent)}`);
          }
        }
      }

      const summary = `Analyzed ${result.items.length} file(s): ${errors} error(s), ${warnings} warning(s) in ${filesWithIssues} file(s)`;
      return {
        content: [
          {
            type: "text",
            text: `action: workspace-diagnostics\n${summary}\n\n${out.length ? out.join("\n") : "No diagnostics."}`,
          },
        ],
        details: result as unknown as Record<string, unknown>,
      };
    },

    renderCall(_args, theme) {
      const params = _args as LspParamsType;
      let text = theme.fg(
        "toolTitle",
        theme.bold("lsp-workspace-diagnostics ") +
          theme.fg("accent", "workspace-diagnostics"),
      );
      text += " " + theme.fg("warning", `${params.files?.length || 0} file(s)`);
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
        if (/^(action|severity):/.test(lines[i])) headerEnd = i + 1;
        else break;
      }

      const header = lines.slice(0, headerEnd);
      const content = lines.slice(headerEnd);
      const maxLines = options.expanded ? content.length : 20;
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
}
