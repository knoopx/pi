import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import type { ExperimentRuntime, ExperimentState } from "./state";
import {
  runHook,
  steerMessageFor,
  appendHookLogEntryIfConfigured,
  type HookPayload,
  type SessionSnapshot,
} from "./hooks";
import { experimentJsonlPath, experimentMdPath } from "./paths";
import { resolveWorkDir } from "./config";

function buildSessionSnapshot(state: ExperimentState): SessionSnapshot {
  return {
    metric_name: state.metricName,
    metric_unit: state.metricUnit,
    direction: state.bestDirection,
    baseline_metric: state.bestMetric,
    best_metric: null,
    run_count: state.results.length,
    goal: state.name ?? "",
  };
}

function isRunEntry(entry: unknown): entry is Record<string, unknown> {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "run" in entry &&
    typeof (entry as Record<string, unknown>).run === "number"
  );
}

function readLastRun(workDir: string): Record<string, unknown> | null {
  const jsonlPath = experimentJsonlPath(workDir);
  if (!fs.existsSync(jsonlPath)) return null;
  const lines = fs.readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      if (isRunEntry(JSON.parse(lines[i]))) return JSON.parse(lines[i]);
    } catch {
      // skip malformed lines
    }
  }
  return null;
}

export async function fireBeforeHook(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  runtime: ExperimentRuntime,
): Promise<void> {
  const workDir = resolveWorkDir(ctx.cwd);
  const state = runtime.state;
  const _steer = await runHookAndSteer(pi, {
    event: "before",
    cwd: workDir,
    next_run: state.results.length + 1,
    last_run: readLastRun(workDir),
    session: buildSessionSnapshot(state),
  });
}

async function runHookAndSteer(
  pi: ExtensionAPI,
  payload: HookPayload,
): Promise<string | null> {
  const result = await runHook(payload);
  appendHookLogEntryIfConfigured(
    experimentJsonlPath(payload.cwd),
    payload.event,
    result,
  );
  const steer = steerMessageFor(payload.event, result);
  if (steer) pi.sendUserMessage(steer, { deliverAs: "steer" });
  return steer;
}

export function buildSystemPromptExtra(
  ctx: ExtensionContext,
  _runtime: ExperimentRuntime,
): string {
  const BENCHMARK_GUARDRAIL =
    "Be careful not to overfit to the benchmarks and do not cheat on the benchmarks.";
  const workDir = resolveWorkDir(ctx.cwd);
  const mdPath = experimentMdPath(workDir);
  const ideasPath = workDir + "/experiment.ideas.md";
  const hasIdeas = fs.existsSync(ideasPath);
  const checksPath = workDir + "/experiment.checks.sh";
  const hasChecks = fs.existsSync(checksPath);

  let extra =
    "\n\n## Experiment Mode (ACTIVE)" +
    "\nYou are in experiment mode. Optimize the primary metric through an autonomous experiment loop." +
    "\nUse experiment-init, experiment-run, and experiment-log tools. NEVER STOP until interrupted." +
    `\nExperiment rules: ${mdPath} — read this file at the start of every session and after compaction.` +
    "\nWrite promising but deferred optimizations as bullet points to experiment.ideas.md — don't let good ideas get lost." +
    `\n${BENCHMARK_GUARDRAIL}` +
    "\nIf the user sends a follow-on message while an experiment is running, finish the current experiment-run + experiment-log cycle first, then address their message in the next iteration.";

  if (hasChecks) {
    extra +=
      "\n\n## Backpressure Checks (ACTIVE)" +
      `\n${checksPath} exists and runs automatically after every passing benchmark in experiment-run.` +
      "\nIf the benchmark passes but checks fail, experiment-run will report it clearly." +
      "\nUse status 'checks_failed' in experiment-log when this happens — it behaves like a crash (no commit, changes auto-reverted)." +
      "\nYou cannot use status 'keep' when checks have failed." +
      "\nThe checks execution time does NOT affect the primary metric.";
  }

  if (hasIdeas) {
    extra += `\n\n💡 Ideas backlog exists at ${ideasPath} — check it for promising experiment paths. Prune stale entries.`;
  }

  return extra;
}
