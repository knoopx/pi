/**
 * Shared utilities for extension tools
 */

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";

/**
 * Create a standard text result for tool execution
 */
export function textResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, details };
}

/**
 * Prompt user to confirm a destructive operation.
 * Blocks in non-interactive mode. Returns an error result on denial, or null to proceed.
 */
export async function dangerousOperationConfirmation(
  ctx: {
    hasUI: boolean;
    ui: { confirm(title: string, message: string): Promise<boolean> };
  },
  title: string,
  message: string,
): Promise<AgentToolResult<Record<string, unknown>> | null> {
  if (!ctx.hasUI)
    return errorResult("Blocked: requires interactive confirmation");
  if (!(await ctx.ui.confirm(title, message)))
    return errorResult("Cancelled by user");
  return null;
}

/**
 * Create an error result for tool execution
 */
export function errorResult(
  error: unknown,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { ...details, error: message },
  };
}
