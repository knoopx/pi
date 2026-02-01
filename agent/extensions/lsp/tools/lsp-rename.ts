/**
 * LSP Rename Tool
 *
 * Rename a symbol with the new name
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
import { getOrCreateManager } from "../core/manager";
import {
  type LspParamsType,
  abortable,
  cancelledToolResult,
  formatWorkspaceEdit,
} from "../core/utils";
import { resolvePosition } from "../core/diagnostics";

/**
 * LSP Rename Tool
 */
export function lspRenameTool(api: ExtensionAPI) {
  return api.registerTool({
    name: "lsp-rename",
    label: "Rename",
    description: "Rename a symbol with the new name",
    parameters: Type.Object({
      file: Type.String({ description: "File path" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      column: Type.Number({ description: "Column number (1-based)" }),
      newName: Type.String({ description: "New name for the symbol" }),
      query: Type.Optional(
        Type.String({
          description:
            "Query string for symbol search (alternative to line/col)",
        }),
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
      const { file, line, column, newName, query } = params as LspParamsType;

      let rLine = line,
        rCol = column,
        _fromQuery = false;
      if ((rLine === undefined || rCol === undefined) && query && file) {
        const resolved = await abortable(
          resolvePosition(manager, file!, query),
          signal,
        );
        if (resolved) {
          rLine = resolved.line;
          rCol = resolved.character;
          _fromQuery = true;
        }
      }
      if (rLine === undefined || rCol === undefined) {
        throw new Error(
          `Action "rename" requires line/column or a query matching a symbol.`,
        );
      }

      const result = await abortable(
        manager.rename(file!, rLine!, rCol!, newName!),
        signal,
      );
      if (!result)
        return {
          content: [
            {
              type: "text",
              text: `action: rename\nNo rename available at this position.`,
            },
          ],
          details: null as unknown as Record<string, unknown>,
        };
      const edits = formatWorkspaceEdit(result, ctx?.cwd);

      return {
        content: [
          {
            type: "text",
            text: `action: rename\nnewName: ${newName}\n\n${edits}`,
          },
        ],
        details: result,
      };
    },

    renderCall(_args, theme) {
      const params = _args as LspParamsType;
      let text =
        theme.fg("toolTitle", theme.bold("lsp-rename ")) +
        theme.fg("accent", "rename");
      text += " " + theme.fg("warning", `:${params.line}:${params.column}`);
      text += " " + theme.fg("accent", `"${params.newName}"`);
      if (params.file) text += " " + theme.fg("muted", params.file);
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
        if (/^(action|newName):/.test(lines[i])) headerEnd = i + 1;
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
