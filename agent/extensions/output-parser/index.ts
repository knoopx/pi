import type {
  ExtensionAPI,
  TurnEndEvent,
} from "@earendil-works/pi-coding-agent";
import type { Message } from "@earendil-works/pi-ai";
import { parseTextToolCalls } from "./parser";

// Detects malformed/fenced tool calls in assistant text and nudges the model
// back onto native tool-calling. Active-repair (executing extracted calls
// and synthesizing tool_result messages) is intentionally not attempted on
// the headline Qwen3.6-35B-A3B path, which uses native tool calling. When
// extracted calls ARE detected, we log them via ctx.ui.notify and queue a
// follow-up nudge for the next turn.

function extractAssistantText(message: Message): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: "text"; text: string } => c?.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}

function hasNativeToolCalls(message: Message): boolean {
  const content = message.content;
  if (!Array.isArray(content)) return false;
  return content.some((c) => c?.type === "toolCall");
}

function extractMessage(event: TurnEndEvent): Message | null {
  const raw = event.message;
  if (!raw || !("content" in raw)) return null;
  const message = raw as Message;
  return hasNativeToolCalls(message) ? null : message;
}

function extractCallsFromEvent(
  event: TurnEndEvent,
): { message: Message; calls: ReturnType<typeof parseTextToolCalls> } | null {
  const message = extractMessage(event);
  if (!message) return null;

  const text = extractAssistantText(message);
  if (!text) return null;
  const calls = parseTextToolCalls(text);
  return calls.length > 0 ? { message, calls } : null;
}

function handleTurnEnd(
  event: TurnEndEvent,
  ctx: { ui: { notify(msg: string, type: string): void } },
  pi: ExtensionAPI,
): void {
  const result = extractCallsFromEvent(event);
  if (!result) return;

  const { calls } = result;
  const names = calls.map((c) => c.name).join(", ");
  ctx.ui.notify(
    `Detected ${calls.length} text-embedded tool call(s) [${names}] — nudging model to native tool calling`,
    "warning",
  );

  pi.sendUserMessage(
    "Your previous response embedded tool calls inside text (e.g. fenced ```tool blocks or <tool_call> tags). " +
      "Please re-issue them as NATIVE tool calls. If the intended calls were: " +
      calls.map((c) => `${c.name}(${JSON.stringify(c.input)})`).join("; ") +
      " — please execute them now using your tool-call channel, not text.",
    { deliverAs: "followUp" },
  );
}

export default function (pi: ExtensionAPI) {
  pi.on("turn_end", async (event, ctx) => {
    handleTurnEnd(event as TurnEndEvent, ctx as any, pi);
  });
}
