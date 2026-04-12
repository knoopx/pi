/**
 * Shared utilities for tool result rendering
 */

import type { AgentToolResult, Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

/**
 * Standard render function for tool results with error handling
 */
export function renderTextToolResult(
  result: AgentToolResult<unknown>,
  theme: Theme,
): Text {
  const details = result.details as { error?: string } | undefined;
  if (details?.error) {
    return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  }
  const text = result.content[0]?.type === "text" ? result.content[0].text : "";
  return new Text(text, 0, 0);
}
