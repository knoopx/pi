import type { AgentToolResult, Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import type { ToolRenderContext } from "./types";

interface RenderResultContext {
  isError: boolean;
}

/**
 * Extract text content from AgentToolResult
 */
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

/**
 * Get error text from result content for display
 */
function getErrorText(content: AgentToolResult<unknown>["content"]): string {
  return extractTextContent(content) || "Error";
}

/**
 * Render error result as themed text component
 */
export function renderError(
  content: AgentToolResult<unknown>["content"],
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): Component {
  const errorText = getErrorText(content);
  text.setText(`\n${theme.fg("error", errorText)}`);
  return text;
}

/**
 * Get first text item from result content with length limit
 */
function getFirstText(
  content: AgentToolResult<unknown>["content"],
  maxLength = 120,
): string {
  const firstItem = content?.[0];
  if (firstItem?.type !== "text") throw new Error("No text content in result");
  return firstItem.text.slice(0, maxLength);
}

/**
 * Render empty result as dimmed text
 */
function renderEmpty(
  content: AgentToolResult<unknown>["content"],
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): Component {
  const firstLine = getFirstText(content);
  text.setText(`  ${theme.fg("dim", firstLine)}`);
  return text;
}

/**
 * Count non-empty lines in text
 */
export function countLines(text: string): number {
  return text.trim().split("\n").filter(Boolean).length;
}

/**
 * Get or reuse TextComponent from context
 */
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

/**
 * Handle common renderResult pattern: error check and details
 */
function handleRenderResult<T>(
  result: AgentToolResult<T>,
  ctx: RenderResultContext,
  theme: Theme,
  text: Component & { setText: (s: string) => void },
  renderDetails: (d: Record<string, unknown>) => Component | undefined,
): Component {
  if (ctx.isError) return renderError(result.content, theme, text);

  const d = result.details as unknown as Record<string, unknown>;
  const rendered = renderDetails(d);
  if (rendered) return rendered;

  return renderEmpty(result.content, theme, text);
}

/**
 * Build a standard renderCall function for tool invocations.
 */
export function buildRenderCall(
  cwd: string,
  home: string,
  toolName: string,
  args: Record<string, unknown>,
  theme: Theme,
  _ctx: ToolRenderContext<unknown, unknown>,
  suffix?: (args: Record<string, unknown>, theme: Theme) => string,
): Component {
  const text = new Text("", 0, 0);
  const sp = (p: string) => {
    const { shortPath } = require("../utils");
    return shortPath(cwd, home, p);
  };
  let pathStr = "";
  const pathArg = args.path as string | undefined;
  if (pathArg) pathStr = sp(pathArg);
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

/**
 * Build a standard renderResult function that dispatches by details type.
 */
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

    const d = result.details as Record<string, unknown>;
    if ((d?._type as string) === detailType && d.text) {
      const rendered = renderContent(d.text as string, theme);
      if (rendered instanceof Promise) {
        rendered.then((content) => {
          text.setText(`${content}\n${footerFn(d, theme)}`);
        });
      } else {
        text.setText(`${rendered}\n${footerFn(d, theme)}`);
      }
      return text;
    }

    const fallback = result.content?.[0] as { text?: string } | undefined;
    text.setText(
      `  ${theme.fg("dim", (fallback?.text ?? toolName).slice(0, 120))}`,
    );
    return text;
  };
}
