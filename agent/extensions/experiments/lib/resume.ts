import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { ExperimentRuntime } from "./state";

const MAX_AUTORESUME_TURNS = 20;
const BENCHMARK_GUARDRAIL =
  "Be careful not to overfit to the benchmarks and do not cheat on the benchmarks.";
const SETTLED_WINDOW_MS = 800;

function isAgentSettled(ctx: ExtensionContext): boolean {
  return ctx.isIdle() && !ctx.hasPendingMessages();
}

function hasPendingResume(runtime: ExperimentRuntime): boolean {
  return runtime.pendingResumeMessage !== null;
}

export function pausePendingResume(runtime: ExperimentRuntime): void {
  if (!runtime.pendingResumeTimer) return;
  clearTimeout(runtime.pendingResumeTimer);
  runtime.pendingResumeTimer = null;
}

export function cancelPendingResume(runtime: ExperimentRuntime): void {
  pausePendingResume(runtime);
  runtime.pendingResumeMessage = null;
}

function markAutoResumeSent(runtime: ExperimentRuntime): void {
  runtime.autoResumeTurns++;
}

function hasReachedAutoResumeLimit(runtime: ExperimentRuntime): boolean {
  return runtime.autoResumeTurns >= MAX_AUTORESUME_TURNS;
}

function notifyAutoResumeLimitReached(ctx: ExtensionContext): void {
  ctx.ui.notify(
    `Experiment auto-resume limit reached (${MAX_AUTORESUME_TURNS} turns)`,
    "info",
  );
}

function composeResumeMessage(): string {
  return [
    "Run the next iteration now.",
    "Use the persisted experiment state as needed, pick the most promising hypothesis, then call experiment-run + experiment-log.",
    BENCHMARK_GUARDRAIL,
  ].join(" ");
}

export function composeCompactionResumeMessage(): string {
  return [
    "Run the next iteration now.",
    "Pick the most promising hypothesis from the ideas backlog or the latest `next:` hints in recent runs, then call experiment-run + experiment-log.",
    "Do not re-read experiment.md or experiment.jsonl — the compaction summary already contains them.",
    BENCHMARK_GUARDRAIL,
  ].join(" ");
}

export function shouldAutoResumeAfterTurn(runtime: ExperimentRuntime): boolean {
  return runtime.experimentMode && runtime.experimentsThisSession > 0;
}

export function shouldAutoResumeAfterCompact(
  runtime: ExperimentRuntime,
): boolean {
  return runtime.experimentMode;
}

export function createResumeManager(pi: ExtensionAPI) {
  return {
    sendPendingResumeIfReady(
      ctx: ExtensionContext,
      runtime: ExperimentRuntime,
    ): void {
      const message = runtime.pendingResumeMessage;
      if (!message) return;
      if (!runtime.experimentMode) {
        cancelPendingResume(runtime);
        return;
      }
      if (!isAgentSettled(ctx)) return;
      if (hasReachedAutoResumeLimit(runtime)) {
        cancelPendingResume(runtime);
        notifyAutoResumeLimitReached(ctx);
        return;
      }

      cancelPendingResume(runtime);
      markAutoResumeSent(runtime);
      pi.sendUserMessage(message);
    },

    schedulePendingResume(
      ctx: ExtensionContext,
      runtime: ExperimentRuntime,
      message: string,
    ): void {
      pausePendingResume(runtime);
      runtime.pendingResumeMessage = message;
      runtime.pendingResumeTimer = setTimeout(
        () => this.sendPendingResumeIfReady(ctx, runtime),
        SETTLED_WINDOW_MS,
      );
    },

    reschedulePendingResume(
      ctx: ExtensionContext,
      runtime: ExperimentRuntime,
    ): void {
      if (!hasPendingResume(runtime)) return;
      this.schedulePendingResume(ctx, runtime, runtime.pendingResumeMessage!);
    },

    ensurePendingResume(
      ctx: ExtensionContext,
      runtime: ExperimentRuntime,
      gate: (runtime: ExperimentRuntime) => boolean,
      composeMessage: () => string = composeResumeMessage,
    ): void {
      if (hasPendingResume(runtime)) {
        this.reschedulePendingResume(ctx, runtime);
        return;
      }
      if (!gate(runtime)) return;
      if (hasReachedAutoResumeLimit(runtime)) {
        notifyAutoResumeLimitReached(ctx);
        return;
      }
      this.schedulePendingResume(ctx, runtime, composeMessage());
    },
  };
}
