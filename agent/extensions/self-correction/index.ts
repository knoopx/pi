import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  MAX_CONSECUTIVE_CORRECTIONS,
  assessResponse,
  buildCorrectionMessage,
  createSteeringState,
  extractContent,
  isTerminalMessage,
  type SteeringResult,
  type SteeringState,
} from "./lib/self-correction";

interface ToolExecutionEvent {
  toolName?: string;
}

export default function (pi: ExtensionAPI) {
  const state = createSteeringState();
  const knownTools = new Set<string>();

  pi.on("tool_execution_start", async (event) => {
    const name = (event as ToolExecutionEvent).toolName;
    if (typeof name === "string") knownTools.add(name);
  });

  pi.on("session_start", async () => {
    state.previousToolCalls = [];
    state.consecutiveFailures = 0;
  });

  pi.on("turn_end", async (event, ctx) => {
    const message = (event as { message?: unknown }).message;
    if (!message) return;
    if (isTerminalMessage(message)) return;

    const { text, calls } = extractContent(
      (message as { content?: unknown }).content,
    );
    const verdict = assessResponse(
      text,
      calls,
      state.previousToolCalls,
      knownTools,
    );
    state.previousToolCalls = calls;
    await applySteeringVerdict(verdict, state, knownTools, ctx, pi);
  });
}

async function applySteeringVerdict(
  verdict: SteeringResult,
  state: SteeringState,
  knownTools: Set<string>,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): Promise<void> {
  if (verdict.ok) {
    state.consecutiveFailures = 0;
    return;
  }
  state.consecutiveFailures++;
  if (state.consecutiveFailures > MAX_CONSECUTIVE_CORRECTIONS) {
    ctx.ui.notify(
      `self-correction: ${verdict.reason} (suppressed after ${state.consecutiveFailures} in a row)`,
      "warning",
    );
    return;
  }
  const correction = buildCorrectionMessage(verdict.reason, knownTools);
  ctx.ui.notify(
    `self-correction: ${verdict.reason} → injecting correction`,
    "warning",
  );
  pi.sendUserMessage(correction, { deliverAs: "steer" });
}
