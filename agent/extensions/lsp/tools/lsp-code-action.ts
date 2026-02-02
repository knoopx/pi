/**
 * LSP Code Action Tool
 *
 * Get available code actions for a code range
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
  formatCodeActions,
} from "../core/utils";

/**
 * LSP Code Action Tool
 */
export function lspCodeActionTool(api: ExtensionAPI) {
  return api.registerTool({
    name: "lsp-code-action",
    label: "Code Action",
    description: "Get available code actions for a code range",
    parameters: Type.Object({
      file: Type.String({ description: "File path" }),
      line: Type.Number({ description: "Start line number (1-based)" }),
      column: Type.Number({ description: "Start column number (1-based)" }),
      endLine: Type.Number({ description: "End line number (1-based)" }),
      endColumn: Type.Number({ description: "End column number (1-based)" }),
    }),

    async execute(
      toolCallId: string,
      params: unknown,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<Record<string, unknown>> | undefined,
      ctx: ExtensionContext,
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      if (signal?.aborted) return cancelledToolResult();
      if (typeof onUpdate === "function") {
        onUpdate({
          content: [{ type: "text", text: "Working..." }],
          details: { status: "working" },
        });
      }

      const manager = getOrCreateManager(ctx.cwd);
      const { file, line, column, endLine, endColumn } =
        params as LspParamsType;

      const result = await abortable(
        manager.getCodeActions(file!, line!, column!, endLine!, endColumn!),
        signal,
      );
      const actions = formatCodeActions(result);

      return {
        content: [
          {
            type: "text",
            text: `action: codeAction\n${actions.length ? actions.join("\n") : "No code actions available."}`,
          },
        ],
        details: result as unknown as Record<string, unknown>,
      };
    },

    renderCall(_args, theme) {
      const params = _args as LspParamsType;
      let text =
        theme.fg("toolTitle", theme.bold("lsp-code-action ")) +
        theme.fg("accent", "codeAction");
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
        if (/^(action):/.test(lines[i])) headerEnd = i + 1;
        else break;
      }

      const header = lines.slice(0, headerEnd);
      const content = lines.slice(headerEnd);
      const maxLines = options.expanded ? content.length : 10;
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
