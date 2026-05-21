export function containsAbortText(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("operation aborted") ||
    normalized.includes("aborted") ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled")
  );
}
function extractItemText(item: unknown): string {
  if (typeof item === "string") return item;
  if (!isTextObject(item)) return "";
  const value = (item as { text?: unknown }).text;
  return typeof value === "string" ? value : "";
}

function isTextObject(item: unknown): boolean {
  return !!item && typeof item === "object" && "text" in item;
}

export function extractTextContent(
  content: unknown[] | undefined,
  extraText?: string,
): string {
  const contentText = (content ?? []).map(extractItemText).join("\n");

  return [contentText, extraText ?? ""].filter(Boolean).join("\n");
}
export function isAbortedToolResult(event: {
  isError?: boolean;
  content?: unknown[];
}): boolean {
  if (!event.isError) return false;
  return containsAbortText(extractTextContent(event.content));
}
function isAbortedByStopReason(message: {
  role?: string;
  stopReason?: string;
}): boolean {
  return message.role === "assistant" && message.stopReason === "aborted";
}

export function isAbortedTurnEnd(event: {
  message?: { role?: string; stopReason?: string; errorMessage?: string };
}): boolean {
  const message = event.message;
  if (!message) return false;
  if (isAbortedByStopReason(message)) return true;
  return containsAbortText(message.errorMessage ?? "");
}
function isAbortedAssistantMessage(message: {
  role?: string;
  stopReason?: string;
  errorMessage?: string;
}): boolean {
  if (message.role !== "assistant") return false;
  if (message.stopReason === "aborted") return true;
  return containsAbortText(message.errorMessage ?? "");
}

export function isAbortedAgentEnd(event: { messages?: unknown[] }): boolean {
  const messages = event.messages ?? [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as {
      role?: string;
      stopReason?: string;
      errorMessage?: string;
    };

    if (isAbortedAssistantMessage(message)) return true;
  }

  return false;
}
