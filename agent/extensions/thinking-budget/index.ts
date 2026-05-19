import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Caps thinking tokens per turn. When the budget is exceeded, aborts the
// turn and queues a follow-up nudging the model to commit to an implementation.
//
// Idempotency notes (issue #8 fix):
//   - State is reset on `agent_start` AND `turn_start` so a previous run
//     leaving `aborted=true` cannot leak into the next conversation.
//   - `recoveryPending` gates re-entry: while a recovery is mid-flight,
//     message_update / turn_start cannot re-arm the abort.
//   - The recovery sequence yields one tick (setImmediate) so pi's async
//     abort barrier settles before we queue the follow-up message; without
//     this, fast-streaming local backends drop the follow-up silently and
//     the agent appears to stop.

const DEFAULT_BUDGET = 2048;

interface BudgetState {
  thinkingChars: number;
  budgetForTurn: number;
  aborted: boolean;
  recoveryPending: boolean;
}

function createBudgetState(): BudgetState {
  return {
    thinkingChars: 0,
    budgetForTurn: DEFAULT_BUDGET,
    aborted: false,
    recoveryPending: false,
  };
}

function charsToTokens(chars: number): number {
  // Matches local/context_manager.estimate_tokens (len/3.5)
  return Math.ceil(chars / 3.5);
}

export default function (pi: ExtensionAPI) {
  const state = createBudgetState();

  // Hard reset between conversations. agent_start fires once per /run; if a
  // previous run aborted, `aborted` and `recoveryPending` would otherwise
  // leak into the next conversation.
  pi.on("agent_start", async () => {
    state.thinkingChars = 0;
    state.aborted = false;
    state.recoveryPending = false;
  });

  pi.on("before_agent_start", async () => {
    state.budgetForTurn = DEFAULT_BUDGET;
  });

  pi.on("turn_start", async () => {
    state.thinkingChars = 0;
    // Don't clear `aborted` if a recovery is mid-flight — the recovery
    // turn_end handler clears it once the follow-up has been queued.
    if (!state.recoveryPending) state.aborted = false;
  });

  pi.on("message_update", async (event, ctx) => {
    const ev = (
      event as { assistantMessageEvent?: { type?: string; delta?: unknown } }
    ).assistantMessageEvent;
    if (!ev || ev.type !== "thinking_delta") return;
    const delta = typeof ev.delta === "string" ? ev.delta : "";
    state.thinkingChars += delta.length;
    if (state.aborted || state.recoveryPending) return;
    const tokens = charsToTokens(state.thinkingChars);
    if (tokens > state.budgetForTurn) {
      state.aborted = true;
      state.recoveryPending = true;
      ctx.ui.notify(
        `thinking-budget: ${tokens} > ${state.budgetForTurn} — aborting turn`,

        "warning",
      );
      ctx.abort();
    }
  });

  pi.on("turn_end", async (_event, _ctx) => {
    if (!state.recoveryPending) return;
    // Yield one tick so pi's abort barrier settles before we queue the
    // follow-up. On fast-streaming local backends (qwen3.6 / llama.cpp)
    // queuing immediately after ctx.abort() drops the follow-up silently
    // and the agent appears to stop with no message — issue #8.
    await new Promise<void>((r) => setImmediate(r));
    pi.sendUserMessage(
      "[thinking budget exceeded] Please commit to an implementation now. Stop deliberating and use your tools to make progress.",
      { deliverAs: "followUp" },
    );
    state.recoveryPending = false;
    state.aborted = false;
  });
}
