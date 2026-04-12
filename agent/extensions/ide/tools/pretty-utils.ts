import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component, Text } from "@mariozechner/pi-tui";

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
 * Get fallback text from result with length limit
 */
function getFallbackText(
  content: AgentToolResult<unknown>["content"],
  defaultText: string,
  maxLength = 120,
): string {
  const firstItem = content?.[0];
  const text = firstItem?.type === "text" ? firstItem.text : defaultText;
  return text?.slice(0, maxLength) ?? defaultText;
}

/**
 * Render fallback result as dimmed text
 */
function renderFallback(
  content: AgentToolResult<unknown>["content"],
  defaultText: string,
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): Component {
  const fallback = getFallbackText(content, defaultText);
  text.setText(`  ${theme.fg("dim", fallback)}`);
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
 * Handle common renderResult pattern: error check and fallback
 */
export function handleRenderResult<T>(
  result: AgentToolResult<T>,
  ctx: RenderResultContext,
  theme: Theme,
  text: Component & { setText: (s: string) => void },
  renderDetails: (d: Record<string, unknown>) => Component | undefined,
  defaultText: string,
): Component {
  if (ctx.isError) return renderError(result.content, theme, text);

  const d = result.details as unknown as Record<string, unknown>;
  const rendered = renderDetails(d);
  if (rendered) return rendered;

  return renderFallback(result.content, defaultText, theme, text);
}
