import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  assessResponse,
  buildCorrectionMessage,
  type ToolCall,
} from "./auto-steering";

interface TextContent {
  type: "text";
  text?: string;
}

interface ToolCallContent {
  type: "toolCall";
  name: string;
  arguments?: unknown;
  input?: unknown;
}

type MessageContent = TextContent | ToolCallContent;

interface TurnEndEvent {
  message?: {
    role?: string;
    stopReason?: string;
    content?: unknown;
  };
}

interface ToolExecutionEvent {
  toolName?: string;
}

// Port of local/quality.py (renamed auto-steering). Hooks turn_end, inspects the assistant message
// + previous turn's tool calls, and — if we detect a failure mode — sends
// a correction user message with deliverAs:"steer" so the model gets it
// immediately on its next turn rather than waiting for the next user input.

// Session-scoped state. Pi reuses extensions across turns within a session;
// a fresh extension instance is loaded per session via the session lifecycle.
let previousToolCalls: ToolCall[] = [];
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_CORRECTIONS = 2;

function extractContent(raw: unknown): { text: string; calls: ToolCall[] } {
  const content = (Array.isArray(raw) ? raw : []) as MessageContent[];
  const text = content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  const calls: ToolCall[] = content
    .filter((c): c is ToolCallContent => c.type === "toolCall")
    .map((c) => ({ name: c.name, input: c.arguments ?? c.input ?? {} }));
  return { text, calls };
}

export default function (pi: ExtensionAPI) {
  // Populate the known-tools set lazily by observing tool_execution events.
  // This avoids needing to read pi's tool registry directly.
  const knownTools = new Set<string>();
  pi.on("tool_execution_start", async (event) => {
    const name = (event as ToolExecutionEvent).toolName;
    if (typeof name === "string") knownTools.add(name);
  });

  pi.on("session_start", async () => {
    previousToolCalls = [];
    consecutiveFailures = 0;
  });

  pi.on("turn_end", async (event, ctx) => {
    const message = (event as TurnEndEvent).message;
    if (!message) return;

    // Skip check when the turn was aborted or errored out.
    // Aborted turns (e.g., by ctx.abort()) and error turns (e.g., network
    // failures, 503s) produce no content, which would incorrectly trigger
    // the empty_response correction.
    if (
      message.role === "assistant" &&
      (message.stopReason === "aborted" || message.stopReason === "error")
    ) {
      return;
    }

    const { text, calls } = extractContent(message.content);

    const verdict = assessResponse(text, calls, previousToolCalls, knownTools);
    previousToolCalls = calls;

    if (verdict.ok) {
      consecutiveFailures = 0;
      return;
    }

    consecutiveFailures++;
    if (consecutiveFailures > MAX_CONSECUTIVE_CORRECTIONS) {
      ctx.ui.notify(
        `auto-steering: ${verdict.reason} (suppressed after ${consecutiveFailures} in a row)`,
        "warning",
      );
      return;
    }

    const correction = buildCorrectionMessage(verdict.reason, knownTools);
    ctx.ui.notify(
      `auto-steering: ${verdict.reason} → injecting correction`,
      "warning",
    );
    pi.sendUserMessage(correction, { deliverAs: "steer" });
  });
}
