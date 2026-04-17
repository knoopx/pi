import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { renderTree } from "../renderers";
import {
  extractTextContent,
  countLines,
  buildRenderCall,
  buildRenderResult,
} from "./utils";
import type { ToolRenderContext } from "./types";

interface LsParams {
  path?: string;
  limit?: number;
}

export function createLsExecute(
  orig: (
    tid: string,
    params: unknown,
    sig: unknown,
    upd: unknown,
    ctx: unknown,
  ) => Promise<unknown>,
): (
  tid: string,
  params: LsParams,
  sig: AbortSignal | undefined,
  upd: ((details: Record<string, unknown>) => void) | undefined,
  ctx: any,
) => Promise<unknown> {
  return async (tid, params, sig, upd, ctx) => {
    const p = params as LsParams;
    const result = (await orig(tid, p, sig, upd, ctx)) as {
      content: (TextContent | ImageContent)[];
      details?: Record<string, unknown>;
    };
    const textContent = extractTextContent(result.content);
    const fp = p.path ?? "";
    result.details = {
      _type: "lsResult" as const,
      text: textContent,
      path: fp,
      entryCount: countLines(textContent),
    };
    return result;
  };
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
    buildRenderCall(
      cwd,
      home,
      "ls",
      args as unknown as Record<string, unknown>,
      theme,
      ctx,
      (a: Record<string, unknown>, t: Theme) => {
        const fp = (a as { path?: string }).path ?? ".";
        return ` ${t.fg("accent", fp)}`;
      },
    );
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
