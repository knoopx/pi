/**
 * LSP Definition Tool
 *
 * Get the definition location of a symbol at a specific position
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
  formatLocation,
} from "../core/utils";
import { resolvePosition } from "../core/diagnostics";

/**
 * LSP Definition Tool
 */
export function lspDefinitionTool(api: ExtensionAPI) {
  return api.registerTool({
    name: "lsp-definition",
    label: "Definition",
    description:
      "Get the definition location of a symbol at a specific position",
    parameters: Type.Object({
      file: Type.String({ description: "File path" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      column: Type.Number({ description: "Column number (1-based)" }),
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
      const { file, line, column, query } = params as LspParamsType;

      let rLine = line,
        rCol = column,
        fromQuery = false;
      if ((rLine === undefined || rCol === undefined) && query && file) {
        const resolved = await abortable(
          resolvePosition(manager, file!, query),
          signal,
        );
        if (resolved) {
          rLine = resolved.line;
          rCol = resolved.character;
          fromQuery = true;
        }
      }
      if (rLine === undefined || rCol === undefined) {
        throw new Error(
          `Action "definition" requires line/column or a query matching a symbol.`,
        );
      }

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
            text: `action: definition\n${payload}`,
          },
        ],
        details: results as unknown as Record<string, unknown>,
      };
    },

    renderCall(_args, theme) {
      const params = _args as LspParamsType;
      let text =
        theme.fg("toolTitle", theme.bold("lsp-definition ")) +
        theme.fg("accent", "definition");
      if (params.query)
        text += " " + theme.fg("dim", `query="${params.query}"`);
      else
        text += " " + theme.fg("warning", `:${params.line}:${params.column}`);
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
        if (/^(action|query):/.test(lines[i])) headerEnd = i + 1;
        else break;
      }

      const header = lines.slice(0, headerEnd);
      const content = lines.slice(headerEnd);
      const maxLines = options.expanded ? content.length : 5;
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
