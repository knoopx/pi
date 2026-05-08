import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
export function renderTextToolResult<T = unknown>(
  result: AgentToolResult<T>,
  theme: Theme,
): Text {
  const details = result.details as { error?: string } | undefined;
  if (details?.error) {
    return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  }
  const text = result.content[0]?.type === "text" ? result.content[0].text : "";
  return new Text(text, 0, 0);
}
