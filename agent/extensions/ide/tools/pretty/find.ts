import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { renderFindResults } from "../renderers";
import {
  extractTextContent,
  countLines,
  buildRenderCall,
  buildRenderResult,
} from "./utils";
import type { ToolRenderContext } from "./types";

interface FindParams {
  pattern: string;
  path?: string;
  limit?: number;
}

export function createFindExecute(
  orig: (
    tid: string,
    params: unknown,
    sig: unknown,
    upd: unknown,
    ctx: unknown,
  ) => Promise<unknown>,
): (
  tid: string,
  params: FindParams,
  sig: AbortSignal | undefined,
  upd: ((details: Record<string, unknown>) => void) | undefined,
  ctx: any,
) => Promise<unknown> {
  return async (tid, params, sig, upd, ctx) => {
    const p = params as FindParams;
    const result = (await orig(tid, p, sig, upd, ctx)) as {
      content: (TextContent | ImageContent)[];
      details?: Record<string, unknown>;
    };
    const textContent = extractTextContent(result.content);
    result.details = {
      _type: "findResult" as const,
      text: textContent,
      pattern: p.pattern ?? "",
      matchCount: countLines(textContent),
    };
    return result;
  };
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
    buildRenderCall(
      cwd,
      home,
      "find",
      args as unknown as Record<string, unknown>,
      theme,
      ctx,
    );
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
