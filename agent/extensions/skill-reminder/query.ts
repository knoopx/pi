import type {
  BeforeAgentStartEvent,
  ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import { isTextContent } from "./guards";

function extractTextItems(content: readonly unknown[] | undefined): string[] {
  return (content ?? [])
    .filter(isTextContent)
    .map((item) => item.text)
    .filter(
      (text): text is string => typeof text === "string" && text.length > 0,
    );
}

const EXCLUDED_INPUT_FIELDS = new Set([
  "edits",
  "content",
  "body",
  "thinking",
  "partialResult",
]);

function cleanInput(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (EXCLUDED_INPUT_FIELDS.has(key)) continue;
    if (typeof value === "string" && value.length > 500) {
      result[key] = value.slice(0, 500);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function buildQuery(event: ToolResultEvent): string {
  const parts: string[] = [`Tool "${event.toolName}" execution failed`];
  parts.push(`Invocation: ${JSON.stringify(cleanInput(event.input))}`);
  parts.push(...extractTextItems(event.content));
  return parts.join("\n");
}

export function extractPromptText(
  prompt: string,
  images?: Array<{ type?: string }>,
): string | null {
  const text = (prompt ?? "").trim();
  if (!text) return null;

  const imageCount = images?.length;
  return imageCount ? `${text}\n[Image attachments: ${imageCount}]` : text;
}
