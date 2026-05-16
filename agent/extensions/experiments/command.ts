import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import type { ExperimentRuntime } from "./lib/state";
import { experimentMdPath, experimentJsonlPath } from "./lib/paths";
import { resolveWorkDir } from "./lib/config";
import { fireBeforeHook } from "./lib/hooks-integration";

const BENCHMARK_GUARDRAIL =
  "Be careful not to overfit to the benchmarks and do not cheat on the benchmarks.";

function resetRuntime(runtime: ExperimentRuntime): void {
  runtime.autoResumeTurns = 0;
  runtime.experimentsThisSession = 0;
  runtime.lastRunChecks = null;
  runtime.lastRunDuration = null;
  runtime.runningExperiment = null;
  if (runtime.pendingResumeTimer) clearTimeout(runtime.pendingResumeTimer);
  runtime.pendingResumeTimer = null;
  runtime.pendingResumeMessage = null;
}

function experimentHelp(): string {
  return [
    "Usage: /experiment [off|clear|<text>]",
    "",
    "<text> enters experiment mode and starts or resumes the loop.",
    "off leaves experiment mode.",
    "clear deletes experiment.jsonl and turns experiment mode off.",
    "",
    "Examples:",
    "  /experiment optimize unit test runtime, monitor correctness",
    "  /experiment model training, run 5 minutes of train.py and note the loss ratio",
  ].join("\n");
}

function handleExperimentOff(
  runtime: ExperimentRuntime,
  ctx: ExtensionContext,
): void {
  const wasRunning = !ctx.isIdle();
  runtime.experimentMode = false;
  resetRuntime(runtime);
  if (wasRunning) ctx.abort();
  ctx.ui.notify(
    wasRunning
      ? "Experiment mode OFF — aborting current run"
      : "Experiment mode OFF",
    "info",
  );
}

function handleExperimentClear(
  runtime: ExperimentRuntime,
  ctx: ExtensionContext,
  reconstructState: (ctx: ExtensionContext) => void,
): void {
  const jsonlPath = experimentJsonlPath(resolveWorkDir(ctx.cwd));
  runtime.experimentMode = false;
  resetRuntime(runtime);
  reconstructState(ctx);

  if (!fs.existsSync(jsonlPath)) {
    ctx.ui.notify("No experiment.jsonl found. Experiment mode OFF", "info");
    return;
  }

  try {
    fs.unlinkSync(jsonlPath);
    ctx.ui.notify(
      "Deleted experiment.jsonl and turned experiment mode OFF",
      "info",
    );
  } catch (error) {
    ctx.ui.notify(
      `Failed to delete experiment.jsonl: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
  }
}

async function handleExperimentStart(
  pi: ExtensionAPI,
  runtime: ExperimentRuntime,
  ctx: ExtensionContext,
  trimmedArgs: string,
): Promise<void> {
  runtime.experimentMode = true;
  runtime.autoResumeTurns = 0;

  const rulesLoaded = fs.existsSync(experimentMdPath(resolveWorkDir(ctx.cwd)));
  const kickoff = rulesLoaded
    ? `Experiment mode active. ${trimmedArgs} ${BENCHMARK_GUARDRAIL}`
    : `Start experiment: ${trimmedArgs} ${BENCHMARK_GUARDRAIL}`;

  ctx.ui.notify(
    rulesLoaded
      ? "Experiment mode ON — rules loaded from experiment.md"
      : "Experiment mode ON — no experiment.md found, setting up",
    "info",
  );

  await fireBeforeHook(pi, ctx, runtime);

  if (ctx.isIdle()) {
    pi.sendUserMessage(kickoff);
  } else {
    pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
  }
}

export function registerCommand(
  pi: ExtensionAPI,
  getRuntime: (ctx: ExtensionContext) => ExperimentRuntime,
  reconstructState: (ctx: ExtensionContext) => void,
): void {
  pi.registerCommand("experiment", {
    description: "Start, stop, or clear experiment mode",
    handler: async (args, ctx) => {
      const runtime = getRuntime(ctx);
      const trimmedArgs = (args ?? "").trim();

      if (!trimmedArgs) {
        ctx.ui.notify(experimentHelp(), "info");
        return;
      }

      const command = trimmedArgs.toLowerCase();

      if (command === "off") {
        handleExperimentOff(runtime, ctx);
        return;
      }

      if (command === "clear") {
        handleExperimentClear(runtime, ctx, reconstructState);
        return;
      }

      if (runtime.experimentMode) {
        ctx.ui.notify(
          "Experiment already active — use '/experiment off' to stop first",
          "info",
        );
        return;
      }

      handleExperimentStart(pi, runtime, ctx, trimmedArgs);
    },
  });
}
