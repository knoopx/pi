/**
 * LSP Signature Tool
 *
 * Get signature help for the symbol at a specific position
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
  formatSignature,
} from "../core/utils";
import { resolvePosition } from "../core/diagnostics";

/**
 * LSP Signature Tool
 */
export function lspSignatureTool(api: ExtensionAPI) {
  return api.registerTool({
    name: "lsp-signature",
    label: "Signature",
    description: "Get signature help for the symbol at a specific position",
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
          `Action "signature" requires line/column or a query matching a symbol.`,
        );
      }

      const result = await abortable(
        manager.getSignatureHelp(file!, rLine!, rCol!),
        signal,
      );

      return {
        content: [
          {
            type: "text",
            text: `action: signature\n${formatSignature(result)}`,
          },
        ],
        details: (result as unknown as Record<string, unknown>) ?? null,
      };
    },

    renderCall(_args, theme) {
      const params = _args as LspParamsType;
      let text =
        theme.fg("toolTitle", theme.bold("lsp-signature ")) +
        theme.fg("accent", "signature");
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

      return new Text(theme.fg("toolOutput", textContent), 0, 0);
    },
  });
}
