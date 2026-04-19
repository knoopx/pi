import type { AgentToolResult, Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import type { ToolRenderContext } from "./types";
import { shortPath } from "../terminal-utils";

// ─── Execute wrapper factory ──────────────────────────────────────────────
// The pi framework calls tool execute handlers with 5 arguments.
// These types and the handler below match that external contract.
/* eslint-disable max-params -- pi framework requires 5-arg handler signature */

export type ToolExecuteFn = (
  tid: string,
  params: unknown,
  sig: unknown,
  upd: unknown,
  ctx: unknown,
) => Promise<unknown>;

// Typed handler returned by createExecuteWrapper.
export type WrappedToolHandler<P> = (
  tid: string,
  params: P,
  sig: AbortSignal | undefined,
  upd: ((details: Record<string, unknown>) => void) | undefined,
  ctx: unknown,
) => Promise<unknown>;

interface ToolResult {
  content: (AgentToolResult<unknown> extends {
    content: infer C;
  }
    ? C
    : Array<{ type?: string }>) &
    Array<{ type?: string }>;
  details?: Record<string, unknown>;
}

export function createExecuteWrapper<Params>(
  postProcess: (
    result: ToolResult,
    textContent: string,
    params: Params,
  ) => void,
): (orig: ToolExecuteFn) => WrappedToolHandler<Params> {
  return (orig) => {
    const handler = async (
      tid: string,
      params: unknown,
      sig: unknown,
      upd: unknown,
      ctx: unknown,
    ): Promise<unknown> => {
      const p = params as Params;
      const result = (await orig(tid, p, sig, upd, ctx)) as ToolResult;
      const textContent = extractTextContent(result.content);
      postProcess(result, textContent, p);
      return result;
    };
    return handler as WrappedToolHandler<Params>;
  };
}
/* eslint-enable max-params */

export function extractTextContent(
  content: AgentToolResult<unknown>["content"],
): string {
  return (
    content
      ?.filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text || "")
      .join("\n") ?? ""
  );
}

function getErrorText(content: AgentToolResult<unknown>["content"]): string {
  return extractTextContent(content) || "Error";
}

export function renderError(
  content: AgentToolResult<unknown>["content"],
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): Component {
  const errorText = getErrorText(content);
  text.setText(`\n${theme.fg("error", errorText)}`);
  return text;
}

export function countLines(text: string): number {
  return text.trim().split("\n").filter(Boolean).length;
}

export function getTextComponent(
  ctx: { lastComponent: Component | undefined },
  TextComponent: typeof Text,
): Component & { setText: (s: string) => void } {
  return (
    ctx.lastComponent instanceof TextComponent
      ? ctx.lastComponent
      : new TextComponent("", 0, 0)
  ) as Component & {
    setText: (s: string) => void;
  };
}

interface BuildRenderCallOptions {
  cwd: string;
  home: string;
  toolName: string;
  args: Record<string, unknown>;
  theme: Theme;
  ctx: ToolRenderContext<unknown, unknown>;
  suffix?: (args: Record<string, unknown>, theme: Theme) => string;
}

export function buildRenderCall(options: BuildRenderCallOptions): Component {
  const { cwd, home, toolName, args, theme, suffix } = options;
  const text = new Text("", 0, 0);
  let pathStr = "";
  const pathArg = args.path as string | undefined;
  if (pathArg) pathStr = shortPath(cwd, home, pathArg);
  else {
    const pattern = args.pattern as string | undefined;
    if (pattern) pathStr = theme.fg("accent", pattern);
  }
  const extraSuffix = suffix ? suffix(args, theme) : "";
  text.setText(
    `${theme.fg("toolTitle", theme.bold(toolName))} ${theme.fg(
      "accent",
      pathStr,
    )}${extraSuffix}`,
  );
  return text;
}

function applyRenderedContent(
  rendered: string | Promise<string>,
  text: { setText: (s: string) => void },
  footer: string,
): void {
  if (rendered instanceof Promise) {
    void rendered.then((content) => {
      text.setText(`${content}\n${footer}`);
    });
  } else {
    text.setText(`${rendered}\n${footer}`);
  }
}

export function buildRenderResult<DetailsType extends string, Args>(
  toolName: string,
  detailType: DetailsType,
  renderContent: (text: string, theme: Theme) => string | Promise<string>,
  footerFn: (d: Record<string, unknown>, theme: Theme) => string,
): (
  result: AgentToolResult<Record<string, unknown>>,
  options: { expanded?: boolean; isPartial?: boolean },
  theme: Theme,
  ctx: ToolRenderContext<unknown, Args>,
) => Component {
  return (result, _options, theme, ctx) => {
    const text = new Text("", 0, 0);
    if (ctx.isError) return renderError(result.content, theme, text);

    const detailResult = tryRenderDetail({
      details: result.details,
      detailType,
      renderContent,
      footerFn,
      text,
      theme,
    });
    if (detailResult) return detailResult;

    const fallbackText = getFallbackText(result.content, toolName, theme);
    text.setText(fallbackText);
    return text;
  };
}

function tryRenderDetail(opts: {
  details: Record<string, unknown> | undefined;
  detailType: string;
  renderContent: (text: string, theme: Theme) => string | Promise<string>;
  footerFn: (d: Record<string, unknown>, theme: Theme) => string;
  text: Component & { setText: (s: string) => void };
  theme: Theme;
}): Component | null {
  const { details, detailType, renderContent, footerFn, text, theme } = opts;
  if (!details || details._type !== detailType) return null;
  const d = details as { text?: unknown };
  if (!d.text) return null;

  applyRenderedContent(
    renderContent(d.text as string, theme),
    text,
    footerFn(details, theme),
  );
  return text;
}

function getFallbackText(
  content: AgentToolResult<unknown>["content"] | undefined,
  toolName: string,
  theme: Theme,
): string {
  const raw = (content?.[0] as { text?: string })?.text;
  const displayText = raw ?? toolName;
  return `  ${theme.fg("dim", displayText.slice(0, 120))}`;
}
