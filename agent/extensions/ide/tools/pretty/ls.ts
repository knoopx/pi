import type { AgentToolResult, Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { renderTree } from "../renderers";
import {
  createExecuteWrapper,
  countLines,
  buildRenderCall,
  buildRenderResult,
  type ToolExecuteFn,
  type WrappedToolHandler,
} from "./utils";
import type { ToolRenderContext } from "./types";

interface LsParams {
  path?: string;
  limit?: number;
}

export function createLsExecute(
  orig: ToolExecuteFn,
): WrappedToolHandler<LsParams> {
  return createExecuteWrapper<LsParams>((result, textContent, p) => {
    result.details = {
      _type: "lsResult" as const,
      text: textContent,
      path: p.path ?? "",
      entryCount: countLines(textContent),
    };
  })(orig);
}

export function createLsRenderCall(
  cwd: string,
  home: string,
): (
  args: LsParams,
  theme: Theme,
  ctx: ToolRenderContext<unknown, LsParams>,
) => Component {
  return (args, theme, ctx) =>
    buildRenderCall({
      cwd,
      home,
      toolName: "ls",
      args: args as unknown as Record<string, unknown>,
      theme,
      ctx,
      suffix: (a: Record<string, unknown>, t: Theme) => {
        const fp = (a as { path?: string }).path ?? ".";
        return ` ${t.fg("accent", fp)}`;
      },
    });
}

export function createLsRenderResult(): (
  result: AgentToolResult<{ text: string }>,
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme,
  ctx: ToolRenderContext<unknown, LsParams>,
) => Component {
  return buildRenderResult(
    "ls",
    "lsResult",
    renderTree,
    (d: Record<string, unknown>, theme: Theme) =>
      `  ${theme.fg("dim", `${d.entryCount} entries`)}`,
  );
}
