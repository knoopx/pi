export function containsAbortText(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("operation aborted") ||
    normalized.includes("aborted") ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled")
  );
}

export function extractTextContent(
  content: unknown[] | undefined,
  extraText?: string,
): string {
  const contentText = (content ?? [])
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        const value = (item as { text?: unknown }).text;
        return typeof value === "string" ? value : "";
      }
      return "";
    })
    .join("\n");

  return [contentText, extraText ?? ""].filter(Boolean).join("\n");
}

export function isAbortedToolResult(event: {
  isError?: boolean;
  content?: unknown[];
}): boolean {
  if (!event.isError) return false;
  return containsAbortText(extractTextContent(event.content));
}

export function isAbortedTurnEnd(event: {
  message?: { role?: string; stopReason?: string; errorMessage?: string };
}): boolean {
  const message = event.message;
  if (!message) return false;
  if (message.role === "assistant" && message.stopReason === "aborted")
    return true;

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

    if (message.role !== "assistant") continue;
    if (message.stopReason === "aborted") return true;
    if (containsAbortText(message.errorMessage ?? "")) return true;
  }

  return false;
}
