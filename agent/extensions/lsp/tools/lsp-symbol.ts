/**
 * LSP Symbol Tool
 *
 * Get document symbols from the language server
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
  collectSymbols,
} from "../core/utils";

/**
 * LSP Symbol Tool
 */
export function lspSymbolTool(api: ExtensionAPI) {
  return api.registerTool({
    name: "lsp-symbol",
    label: "Symbol",
    description: "Get document symbols from the language server",
    parameters: Type.Object({
      file: Type.String({ description: "File path" }),
      query: Type.Optional(
        Type.String({
          description: "Optional query string to filter symbols",
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
      const { file, query } = params as LspParamsType;

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
        content: [{ type: "text", text: `action: symbols\n${payload}` }],
        details: symbols as unknown as Record<string, unknown>,
      };
    },

    renderCall(_args, theme) {
      const params = _args as LspParamsType;
      let text =
        theme.fg("toolTitle", theme.bold("lsp-symbol ")) +
        theme.fg("accent", "symbols");
      if (params.query)
        text += " " + theme.fg("dim", `query="${params.query}"`);
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
