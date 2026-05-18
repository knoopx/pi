import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { TextContent } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import * as fs from "node:fs";
import type { ExperimentRuntime } from "../../lib/state";
import { computeConfidence, findBestMetric } from "../../lib/metrics";
import { experimentJsonlPath } from "../../lib/paths";
import { ensureWorkDir } from "../../lib/config";
import {
  validateSecondaryMetrics,
  buildExperimentResult,
  LogParams,
  type LogDetails,
} from "./validate";
import { buildLogText, buildLogTextPlain } from "./format";
import { handleGitCommit, handleGitRevert } from "./git";

function registerNewMetrics(
  secondaryMetrics: Record<string, number>,
  state: ExperimentRuntime["state"],
): void {
  const newMetrics = Object.keys(secondaryMetrics).filter(
    (name) => !state.secondaryMetrics.find((m) => m.name === name),
  );
  for (const name of newMetrics) {
    state.secondaryMetrics.push({ name, unit: "" });
  }
}

function updateBestMetric(
  result: ReturnType<typeof buildExperimentResult>,
  state: ExperimentRuntime["state"],
): void {
  if (result.status !== "keep") return;
  const bestMetric = findBestMetric(state.results, state.currentSegment);
  if (bestMetric !== null) {
    state.bestMetric = bestMetric;
  }
}

function updateConfidence(
  result: ReturnType<typeof buildExperimentResult>,
  state: ExperimentRuntime["state"],
): void {
  const confidence = computeConfidence(
    state.results,
    state.currentSegment,
    state.bestDirection,
  );
  if (confidence !== null && confidence > 0) {
    result.confidence = confidence;
  }
}

async function runGitAction(
  result: ReturnType<typeof buildExperimentResult>,
  pi: ExtensionAPI,
  workDir: string,
): Promise<{ ok: true } | { ok: false; content: TextContent[] }> {
  const gitResult =
    result.status === "keep"
      ? await handleGitCommit(pi, workDir, result)
      : await handleGitRevert(pi, workDir, result);
  if (!gitResult.ok) {
    return {
      ok: false,
      content: [
        { type: "text", text: `󰅗 Git operation failed: ${gitResult.output}` },
      ],
    };
  }
  return { ok: true };
}

async function logExperimentResult(
  params: {
    commit: string;
    status: "keep" | "discard" | "crash" | "checks_failed";
    metric: number;
    description: string;
    metrics?: Record<string, number>;
    force?: boolean;
    asi?: Record<string, unknown>;
  },
  secondaryMetrics: Record<string, number>,
  runtime: ExperimentRuntime,
  state: ExperimentRuntime["state"],
  workDir: string,
  pi: ExtensionAPI,
) {
  if (params.force) {
    registerNewMetrics(secondaryMetrics, state);
  }

  const result = buildExperimentResult(params, secondaryMetrics, state);
  state.results.push(result);

  const logPath = experimentJsonlPath(workDir);
  fs.appendFileSync(
    logPath,
    JSON.stringify({
      ...result,
      metricName: state.metricName,
      metricUnit: state.metricUnit,
      direction: state.bestDirection,
    }) + "\n",
  );

  updateBestMetric(result, state);
  updateConfidence(result, state);

  const gitAction = await runGitAction(result, pi, workDir);
  if (!gitAction.ok) {
    return { content: gitAction.content, details: {} };
  }

  const wallClockSeconds = runtime.lastRunDuration ?? null;

  const text = buildLogTextPlain(
    result,
    state,
    wallClockSeconds,
    secondaryMetrics,
    result.asi ?? {},
  );

  const content: TextContent[] = [{ type: "text", text }];
  return {
    content,
    details: {
      experiment: result,
      state,
      wallClockSeconds,
    },
  };
}

function renderLogResult(d: LogDetails, theme: Theme): string {
  const { experiment, state, wallClockSeconds } = d;
  return buildLogText(
    experiment,
    state,
    wallClockSeconds,
    experiment.metrics ?? {},
    experiment.asi ?? {},
    theme,
  );
}

export function registerLogExperiment(
  pi: ExtensionAPI,
  getRuntime: (ctx: ExtensionContext) => ExperimentRuntime,
  _updateNotify: (ctx: ExtensionContext) => void,
): void {
  pi.registerTool({
    name: "experiment-log",
    label: "Log Experiment",
    description: `Record an experiment result. Tracks metrics, updates the status widget and dashboard. Call after every experiment-run.`,
    promptSnippet:
      "Record an experiment result (commit, metric, status, description)",
    promptGuidelines: [
      "Use status 'keep' if the PRIMARY metric improved. 'discard' if worse or unchanged. 'crash' if it failed. Secondary metrics are for monitoring — they almost never affect keep/discard. Only discard a primary improvement if a secondary metric degraded catastrophically, and explain why in the description.",
      "experiment-log automatically runs git add -A && git commit on 'keep', and auto-reverts code changes on 'discard'/'crash'/'checks_failed' (experiment files are preserved). Do NOT commit or revert manually.",
      "experiment-log reports a confidence score after 3+ runs (best improvement as a multiple of the noise floor). ≥2.0× = likely real, <1.0× = within noise. If confidence is below 1.0×, consider re-running the same experiment to confirm before keeping. The score is advisory — it never auto-discards.",
      'Always include the asi parameter. At minimum: {"hypothesis": "what you tried"}. On discard/crash, also include rollback_reason and next_action_hint. Add any key/value pairs that capture what you learned — dead ends, surprising findings, error details, bottlenecks.',
      "Be concise in your responses",
      "Show file paths clearly when working with files",
    ],
    parameters: LogParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const runtime = getRuntime(ctx);
      const state = runtime.state;

      const workDirResult = ensureWorkDir(ctx.cwd);
      if (!workDirResult.ok) {
        return {
          content: [{ type: "text", text: workDirResult.error }],
          details: {},
        };
      }

      const secondaryMetrics: Record<string, number> =
        (params.metrics as Record<string, number> | undefined) ?? {};

      const validationError = validateSecondaryMetrics(
        { metrics: params.metrics, force: params.force },
        state,
      );
      if (validationError) {
        return {
          content: [{ type: "text", text: validationError }],
          details: {},
        };
      }

      return logExperimentResult(
        {
          commit: params.commit,
          status: params.status,
          metric: params.metric,
          description: params.description,
          metrics: secondaryMetrics,
          force: params.force,
          asi: params.asi as Record<string, unknown> | undefined,
        },
        secondaryMetrics,
        runtime,
        state,
        workDirResult.workDir,
        pi,
      );
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("experiment-log "));
      text += theme.fg(
        args.status === "keep"
          ? "success"
          : args.status === "crash"
            ? "error"
            : "warning",
        args.status,
      );
      text += theme.fg("muted", ` ${args.commit}`);
      text += theme.fg("accent", ` ${args.metric}`);
      return new Text(text, 0, 0);
    },

    renderResult(result, _renderCtx, theme) {
      const d = result.details as LogDetails | undefined;
      if (!d) {
        const t = result.content[0];
        return new Text(t?.type === "text" ? t.text : "", 0, 0);
      }
      const text = renderLogResult(d, theme);
      return new Text(text, 0, 0);
    },
  });
}
