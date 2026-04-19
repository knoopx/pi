import type { AgentToolResult, Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { renderGrepResults } from "../renderers";
import {
  createExecuteWrapper,
  buildRenderCall,
  buildRenderResult,
  type ToolExecuteFn,
  type WrappedToolHandler,
} from "./utils";
import type { ToolRenderContext } from "./types";

interface GrepParams {
  pattern: string;
  path?: string;
  glob?: string;
  ignoreCase?: boolean;
  literal?: boolean;
  context?: number;
  limit?: number;
}

export function createGrepExecute(
  orig: ToolExecuteFn,
): WrappedToolHandler<GrepParams> {
  return createExecuteWrapper<GrepParams>((result, textContent, p) => {
    const matchCount = countGrepMatches(textContent);
    result.details = {
      _type: "grepResult" as const,
      text: textContent,
      pattern: p.pattern ?? "",
      matchCount,
    };
  })(orig);
}

function countGrepMatches(textContent: string | null): number {
  if (!textContent) return 0;
  const lines = textContent.trim().split("\n");
  const regex = /^.+?[:\-]\d+[:\-]/;
  let count = 0;
  for (const l of lines) {
    if (regex.test(l)) count++;
  }
  return count;
}

export function createGrepRenderCall(
  cwd: string,
  home: string,
): (
  args: GrepParams,
  theme: Theme,
  ctx: ToolRenderContext<unknown, GrepParams>,
) => Component {
  return (args, theme, ctx) =>
    buildRenderCall({
      cwd,
      home,
      toolName: "grep",
      args: args as unknown as Record<string, unknown>,
      theme,
      ctx,
      suffix: (a: Record<string, unknown>, t: Theme) => {
        const glob = (a as { glob?: string })?.glob
          ? ` ${t.fg("muted", `(${a.glob})`)}`
          : "";
        return glob;
      },
    });
}

export function createGrepRenderResult(): (
  result: AgentToolResult<{ text: string }>,
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme,
  ctx: ToolRenderContext<unknown, GrepParams>,
) => Component {
  return buildRenderResult(
    "grep",
    "grepResult",
    (textContent: string, theme: Theme) =>
      renderGrepResults(textContent, "", theme),
    (d: Record<string, unknown>, theme: Theme) =>
      theme.fg("dim", `${d.matchCount} matches`),
  );
}
