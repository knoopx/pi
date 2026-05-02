import type { ToolResultEvent } from "@mariozechner/pi-coding-agent";
import { isTextContent } from "../../shared/guards";

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

const toolDescriptions: Record<
  string,
  (cleaned: Record<string, unknown>) => string | null
> = {
  bash: ({ command }) => (command ? `Running command: ${command}` : null),
  read: ({ path }) => (path ? `Reading file: ${path}` : null),
  write: ({ path }) => (path ? `Writing to file: ${path}` : null),
  ls: ({ path }) => (path ? `Listing directory: ${path}` : null),
  edit: ({ path }) => (path ? `Editing file: ${path}` : null),
  grep: ({ pattern, path }) => {
    if (pattern && path) return `Searching for "${pattern}" in ${path}`;
    if (pattern) return `Searching for pattern: ${pattern}`;
    if (path) return `Grep in directory: ${path}`;
    return null;
  },
  find: ({ pattern, path }) => {
    if (pattern && path)
      return `Finding files matching "${pattern}" in ${path}`;
    if (pattern) return `Finding files: ${pattern}`;
    if (path) return `Searching directory: ${path}`;
    return null;
  },
};

function describeToolInput(
  toolName: string,
  input: Record<string, unknown>,
): string | null {
  const cleaned = cleanInput(input);
  if (Object.keys(cleaned).length === 0) return null;

  const descFn = toolDescriptions[toolName];
  if (descFn) return descFn(cleaned);

  // For unknown tools, provide a summary of the input fields
  const entries = Object.entries(cleaned)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
  return entries ? `Tool "${toolName}" with: ${entries}` : null;
}

export function buildQuery(event: ToolResultEvent): string {
  const parts: string[] = [];

  // Describe what was being done
  const toolDesc = describeToolInput(event.toolName, event.input);
  if (toolDesc) {
    parts.push(toolDesc + " failed");
  } else {
    parts.push(`Tool "${event.toolName}" execution failed`);
  }

  // Include all text content as-is for better embeddings
  const texts = extractTextItems(event.content);
  if (texts.length > 0) {
    parts.push(...texts);
  }

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
