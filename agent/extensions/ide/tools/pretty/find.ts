import type { AgentToolResult, Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { renderFindResults } from "../renderers";
import {
  createExecuteWrapper,
  countLines,
  buildRenderCall,
  buildRenderResult,
  type ToolExecuteFn,
  type WrappedToolHandler,
} from "./utils";
import type { ToolRenderContext } from "./types";

interface FindParams {
  pattern: string;
  path?: string;
  limit?: number;
}

export function createFindExecute(
  orig: ToolExecuteFn,
): WrappedToolHandler<FindParams> {
  return createExecuteWrapper<FindParams>((result, textContent, p) => {
    result.details = {
      _type: "findResult" as const,
      text: textContent,
      pattern: p.pattern ?? "",
      matchCount: countLines(textContent),
    };
  })(orig);
}

export function createFindRenderCall(
  cwd: string,
  home: string,
): (
  args: FindParams,
  theme: Theme,
  ctx: ToolRenderContext<unknown, FindParams>,
) => Component {
  return (args, theme, ctx) =>
    buildRenderCall({
      cwd,
      home,
      toolName: "find",
      args: args as unknown as Record<string, unknown>,
      theme,
      ctx,
    });
}

export function createFindRenderResult(): (
  result: AgentToolResult<{ text: string }>,
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme,
  ctx: ToolRenderContext<unknown, FindParams>,
) => Component {
  return buildRenderResult(
    "find",
    "findResult",
    renderFindResults,
    (d: Record<string, unknown>, theme: Theme) =>
      `  ${theme.fg("dim", `${d.matchCount} files`)}`,
  );
}
