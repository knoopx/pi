import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
function extractTextContent<T>(result: AgentToolResult<T>): string {
  if (result.content[0]?.type === "text") return result.content[0].text;
  return "";
}

export function renderTextToolResult<T = unknown>(
  result: AgentToolResult<T>,
  theme: Theme,
): Text {
  const details = result.details as { error?: string } | undefined;
  if (details?.error) {
    return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  }
  return new Text(extractTextContent(result), 0, 0);
}
