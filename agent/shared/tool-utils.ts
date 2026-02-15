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
