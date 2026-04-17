import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { renderGrepResults } from "../renderers";
import {
  extractTextContent,
  buildRenderCall,
  buildRenderResult,
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
  orig: (
    tid: string,
    params: unknown,
    sig: unknown,
    upd: unknown,
    ctx: unknown,
  ) => Promise<unknown>,
): (
  tid: string,
  params: GrepParams,
  sig: AbortSignal | undefined,
  upd: ((details: Record<string, unknown>) => void) | undefined,
  ctx: any,
) => Promise<unknown> {
  return async (tid, params, sig, upd, ctx) => {
    const p = params as GrepParams;
    const result = (await orig(tid, p, sig, upd, ctx)) as {
      content: (TextContent | ImageContent)[];
      details?: Record<string, unknown>;
    };
    const textContent = extractTextContent(result.content);
    let matchCount = 0;
    if (textContent) {
      const lines = textContent.trim().split("\n");
      const regex = /^.+?[:\-]\d+[:\-]/;
      for (const l of lines) {
        if (regex.test(l)) matchCount++;
      }
    }
    result.details = {
      _type: "grepResult" as const,
      text: textContent,
      pattern: p.pattern ?? "",
      matchCount,
    };
    return result;
  };
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
    buildRenderCall(
      cwd,
      home,
      "grep",
      args as unknown as Record<string, unknown>,
      theme,
      ctx,
      (a: Record<string, unknown>, t: Theme) => {
        const glob = (a as { glob?: string })?.glob
          ? ` ${t.fg("muted", `(${a.glob})`)}`
          : "";
        return glob;
      },
    );
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
