import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import type { ExperimentRuntime, ExperimentState } from "./lib/state";
import { RuntimeStore, createExperimentState } from "./lib/state";
import { computeConfidence, findBaselineMetric } from "./lib/metrics";
import { experimentJsonlPath } from "./lib/paths";
import { resolveWorkDir, readMaxExperiments } from "./lib/config";
import { reconstructJsonlState } from "./lib/jsonl";
import {
  experimentSummaryPathsFor,
  buildExperimentCompactionSummary,
} from "./lib/compaction";
import { buildSystemPromptExtra } from "./lib/hooks-integration";
import {
  composeCompactionResumeMessage,
  pausePendingResume,
  cancelPendingResume,
  shouldAutoResumeAfterTurn,
  shouldAutoResumeAfterCompact,
  createResumeManager,
} from "./lib/resume";
import { registerInitExperiment } from "./tools/init-experiment";
import { registerRunExperiment } from "./tools/run-experiment/register";
import { registerLogExperiment } from "./tools/log-experiment/register";
import { registerCommand } from "./command";

function migrateResult(r: {
  metrics?: Record<string, number>;
  confidence?: number | null;
}): void {
  if (!r.metrics) r.metrics = {};
  if (r.confidence === undefined) r.confidence = null;
}

function migrateSessionState(state: ExperimentState): ExperimentState {
  if (!state.secondaryMetrics) state.secondaryMetrics = [];
  if (state.metricUnit === "s" && state.metricName === "metric") {
    state.metricUnit = "";
  }
  for (const r of state.results) migrateResult(r);

  if (state.confidence === undefined) {
    state.confidence = computeConfidence(
      state.results,
      state.currentSegment,
      state.bestDirection,
    );
  }
  return state;
}

export default function experimentsExtension(pi: ExtensionAPI): void {
  const runtimeStore = new RuntimeStore();
  const resume = createResumeManager(pi);
  const getSessionKey = (ctx: ExtensionContext) =>
    ctx.sessionManager.getSessionId();
  const getRuntime = (ctx: ExtensionContext): ExperimentRuntime =>
    runtimeStore.ensure(getSessionKey(ctx));

  const updateNotify = (_ctx: ExtensionContext) => {
    // Notification is shown from experiment-log after each logged result
    // This hook exists for future widget support
  };

  const loadFromJsonl = (
    runtime: ReturnType<typeof runtimeStore.ensure>,
    jsonlPath: string,
  ): boolean => {
    const state = runtime.state;
    try {
      if (!fs.existsSync(jsonlPath)) return false;
      const reconstructed = reconstructJsonlState(
        fs.readFileSync(jsonlPath, "utf-8"),
      );
      state.name = reconstructed.name;
      state.metricName = reconstructed.metricName;
      state.metricUnit = reconstructed.metricUnit;
      state.bestDirection = reconstructed.bestDirection;
      state.currentSegment = reconstructed.currentSegment;
      state.results = reconstructed.results.map((result) => ({
        ...result,
        metrics: { ...result.metrics },
      }));
      state.secondaryMetrics = reconstructed.secondaryMetrics.map((metric) => ({
        ...metric,
      }));

      if (state.results.length > 0) {
        state.bestMetric = findBaselineMetric(
          state.results,
          state.currentSegment,
        );
        state.confidence = computeConfidence(
          state.results,
          state.currentSegment,
          state.bestDirection,
        );
      }
      return true;
    } catch {
      return false;
    }
  };

  function isExperimentLogEntry(entry: {
    type: string;
    message?: unknown;
  }): entry is { type: string; message?: unknown } {
    if (entry.type !== "message") return false;
    const msg = entry.message as
      | {
          role?: string;
          toolName?: string;
          details?: { state?: ExperimentState };
        }
      | undefined;
    return (
      msg?.role === "toolResult" &&
      msg.toolName === "experiment-log" &&
      !!msg.details?.state
    );
  }

  const loadFromSessionHistory = (
    ctx: ExtensionContext,
    runtime: ReturnType<typeof runtimeStore.ensure>,
  ): boolean => {
    for (const entry of ctx.sessionManager.getBranch()) {
      if (!isExperimentLogEntry(entry)) continue;
      const details = (
        entry.message as { details?: { state?: ExperimentState } }
      ).details;
      if (!details?.state) continue;

      runtime.state = migrateSessionState(details.state);
      return true;
    }
    return false;
  };

  const reconstructState = (ctx: ExtensionContext) => {
    const runtime = getRuntime(ctx);
    cancelPendingResume(runtime);
    runtime.lastRunChecks = null;
    runtime.lastRunDuration = null;
    runtime.runningExperiment = null;
    runtime.experimentsThisSession = 0;
    runtime.autoResumeTurns = 0;
    runtime.state = createExperimentState();

    const workDir = resolveWorkDir(ctx.cwd);
    const jsonlPath = experimentJsonlPath(workDir);

    if (!loadFromJsonl(runtime, jsonlPath)) {
      loadFromSessionHistory(ctx, runtime);
    }

    runtime.state.maxExperiments = readMaxExperiments(ctx.cwd);
    runtime.experimentMode = fs.existsSync(jsonlPath);
  };

  // Guard: bail out if ctx is stale (session replacement / reload)
  const isStale = (ctx: ExtensionContext): boolean => {
    try {
      return !runtimeStore.has(ctx.sessionManager.getSessionId());
    } catch {
      return true;
    }
  };

  pi.on("session_start", async (_e, ctx) => reconstructState(ctx));
  pi.on("session_tree", async (_e, ctx) => reconstructState(ctx));
  pi.on("session_shutdown", async (_e, ctx) => {
    // Always cancel all timers first — handles stale ctx case where
    // we can't look up the session key. Prevents dangling setTimeout
    // callbacks that would fire after teardown.
    runtimeStore.cancelAllTimers();
    try {
      runtimeStore.clear(getSessionKey(ctx));
    } catch {
      // ctx is stale — the runtime was already cleaned up by cancelAllTimers
    }
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (isStale(ctx)) return;
    const runtime = getRuntime(ctx);
    runtime.experimentsThisSession = 0;
    pausePendingResume(runtime);
  });

  pi.on("session_before_compact", async (event, ctx) => {
    if (isStale(ctx)) return;
    pausePendingResume(getRuntime(ctx));
    if (!getRuntime(ctx).experimentMode) return undefined;
    return {
      compaction: {
        summary: buildExperimentCompactionSummary(
          experimentSummaryPathsFor(resolveWorkDir(ctx.cwd)),
        ),
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    };
  });

  pi.on("session_compact", async (_event, ctx) => {
    if (isStale(ctx)) return;
    resume.ensurePendingResume(
      ctx,
      getRuntime(ctx),
      shouldAutoResumeAfterCompact,
      composeCompactionResumeMessage,
    );
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (isStale(ctx)) return;
    const runtime = getRuntime(ctx);
    runtime.runningExperiment = null;
    resume.ensurePendingResume(ctx, runtime, shouldAutoResumeAfterTurn);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (isStale(ctx)) return;
    const runtime = getRuntime(ctx);
    if (!runtime.experimentMode) return;
    return {
      systemPrompt: event.systemPrompt + buildSystemPromptExtra(ctx, runtime),
    };
  });

  registerInitExperiment(pi, getRuntime, updateNotify);
  registerRunExperiment(pi, getRuntime, updateNotify);
  registerLogExperiment(pi, getRuntime, updateNotify);

  registerCommand(pi, getRuntime, reconstructState);
}
