import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { TextContent } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import * as fs from "node:fs";
import type { ExperimentRuntime } from "../lib/state";
import { cloneExperimentState } from "../lib/state";
import { experimentJsonlPath } from "../lib/paths";
import { ensureWorkDir, readMaxExperiments } from "../lib/config";
import { fireBeforeHook } from "../lib/hooks-integration";

const InitParams = Type.Object({
  name: Type.String({
    description:
      'Human-readable name for this experiment session (e.g. "Optimizing liquid for fastest execution and parsing")',
  }),
  metric_name: Type.String({
    description:
      'Display name for the primary metric (e.g. "total_µs", "bundle_kb", "val_bpb"). Shown in dashboard headers.',
  }),
  metric_unit: Type.Optional(
    Type.String({
      description:
        'Unit for the primary metric. Use "µs", "ms", "s", "kb", "mb", or "" for unitless. Affects number formatting. Default: ""',
    }),
  ),
  direction: Type.Optional(
    Type.String({
      description:
        'Whether "lower" or "higher" is better for the primary metric. Default: "lower".',
    }),
  ),
});

function initExperimentState(
  state: ExperimentRuntime["state"],
  params: {
    name: string;
    metric_name: string;
    metric_unit?: string;
    direction?: string;
  },
  isReinit: boolean,
  cwd: string,
): void {
  state.name = params.name;
  state.metricName = params.metric_name;
  state.metricUnit = params.metric_unit ?? "";
  if (params.direction === "lower" || params.direction === "higher") {
    state.bestDirection = params.direction;
  }
  if (isReinit) {
    state.currentSegment++;
  }
  state.bestMetric = null;
  state.secondaryMetrics = [];
  state.confidence = null;
  state.maxExperiments = readMaxExperiments(cwd);
}

async function writeConfigJsonl(
  workDir: string,
  state: ExperimentRuntime["state"],
): Promise<void> {
  const jsonlPath = experimentJsonlPath(workDir);
  const config = JSON.stringify({
    type: "config",
    name: state.name,
    metricName: state.metricName,
    metricUnit: state.metricUnit,
    bestDirection: state.bestDirection,
  });
  if (fs.existsSync(jsonlPath)) {
    fs.appendFileSync(jsonlPath, config + "\n");
  } else {
    fs.writeFileSync(jsonlPath, config + "\n");
  }
}

function buildInitResponse(
  state: ExperimentRuntime["state"],
  isReinit: boolean,
  workDir: string,
  cwd: string,
) {
  const reinitNote = isReinit
    ? " (re-initialized — previous results archived, new baseline needed)"
    : "";
  const limitNote =
    state.maxExperiments !== null
      ? `\nMax iterations: ${state.maxExperiments} (from experiment.config.json)`
      : "";
  const workDirNote = workDir !== cwd ? `\nWorking directory: ${workDir}` : "";
  const content: TextContent[] = [
    {
      type: "text",
      text: `󰄬 Experiment initialized: "${state.name}"${reinitNote}\nMetric: ${state.metricName} (${state.metricUnit || "unitless"}, ${state.bestDirection} is better)${limitNote}${workDirNote}\nConfig written to experiment.jsonl. Now run the baseline with experiment-run.`,
    },
  ];
  return {
    content,
    details: { state: cloneExperimentState(state) },
  };
}

export function registerInitExperiment(
  pi: ExtensionAPI,
  getRuntime: (ctx: ExtensionContext) => ExperimentRuntime,
  updateNotify: (ctx: ExtensionContext) => void,
): void {
  pi.registerTool({
    name: "experiment-init",
    label: "Init Experiment",
    description:
      "Initialize the experiment session. Call once before the first experiment-run to set the name, primary metric, unit, and direction. Writes the config header to experiment.jsonl.",
    promptSnippet:
      "Initialize experiment session (name, metric, unit, direction). Call once before first run.",
    promptGuidelines: [
      "Call experiment-init exactly once at the start of an experiment session, before the first experiment-run.",
      "If experiment.jsonl already exists with a config, do NOT call experiment-init again.",
      "If the optimization target changes (different benchmark, metric, or workload), call experiment-init again to insert a new config header and reset the baseline.",
    ],
    parameters: InitParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const runtime = getRuntime(ctx);
      const state = runtime.state;

      const workDirResult = ensureWorkDir(ctx.cwd);
      if (!workDirResult.ok) {
        const content: TextContent[] = [
          { type: "text", text: workDirResult.error },
        ];
        return {
          content,
          details: {},
        };
      }

      const isReinit = state.results.length > 0;
      initExperimentState(state, params, isReinit, ctx.cwd);

      try {
        await writeConfigJsonl(workDirResult.workDir, state);
      } catch (e) {
        const content: TextContent[] = [
          {
            type: "text",
            text: `⚠ Failed to write experiment.jsonl: ${e instanceof Error ? e.message : String(e)}`,
          },
        ];
        return {
          content,
          details: {},
        };
      }

      const wasInactive = !runtime.experimentMode;
      runtime.experimentMode = true;
      updateNotify(ctx);

      if (wasInactive) {
        await fireBeforeHook(pi, ctx, runtime);
      }

      return buildInitResponse(state, isReinit, workDirResult.workDir, ctx.cwd);
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("experiment-init "));
      text += theme.fg("accent", args.name ?? "");
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, _theme) {
      const t = result.content[0];
      return new Text(t?.type === "text" ? t.text : "", 0, 0);
    },
  });
}
