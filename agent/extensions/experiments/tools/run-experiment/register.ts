import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { ExperimentRuntime } from "../../lib/state";
import {
  renderPartialResult,
  type RunDetails,
  type PartialRunDetails,
} from "./render";
import { runExperimentCommand } from "./execution";
import {
  EXPERIMENT_MAX_BYTES,
  EXPERIMENT_MAX_LINES,
  RunParams,
  validateRunExperimentParams,
} from "./validation";
import { getPlainText, formatResultText } from "./status";

export function registerRunExperiment(
  pi: ExtensionAPI,
  getRuntime: (ctx: ExtensionContext) => ExperimentRuntime,
  updateNotify: (ctx: ExtensionContext) => void,
): void {
  pi.registerTool({
    name: "experiment-run",
    label: "Run Experiment",
    description: `Run a shell command as an experiment. Times wall-clock duration, captures output, detects pass/fail via exit code. Output is truncated to last ${EXPERIMENT_MAX_LINES} lines or ${EXPERIMENT_MAX_BYTES / 1024}KB (whichever is hit first). If truncated, full output is saved to a temp file. Use for any experiment experiment.`,
    promptSnippet:
      "Run a timed experiment command (captures duration, output, exit code)",
    promptGuidelines: [
      "Use experiment-run instead of bash when running experiment commands — it handles timing and output capture automatically.",
      "After experiment-run, always call experiment-log to record the result.",
      "If the benchmark script outputs structured METRIC lines (e.g. 'METRIC total_µs=15200'), experiment-run will parse them automatically and suggest exact values for experiment-log. Use these parsed values directly instead of extracting them manually from the output.",
    ],
    parameters: RunParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const runtime = getRuntime(ctx);
      const state = runtime.state;

      const validation = validateRunExperimentParams(params, state, ctx.cwd);
      if (!validation.ok) {
        return {
          content: [{ type: "text", text: validation.error }],
          details: {},
        };
      }

      return runExperimentCommand({
        params,
        workDir: validation.workDir,
        timeout: validation.timeout,
        runtime,
        state,
        signal,
        onUpdate,
        ctx,
        pi,
        updateNotify,
      });
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("experiment-run "));
      text += theme.fg("muted", args.command);
      if (args.timeout_seconds) {
        text += theme.fg("dim", ` (timeout: ${args.timeout_seconds}s)`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) {
        return renderPartialResult(
          result as {
            content: Array<{ type: string; text?: string }>;
            details?: PartialRunDetails;
          },
          expanded,
          5,
          theme,
        );
      }

      const d = result.details as RunDetails | undefined;
      if (!d) {
        return new Text(getPlainText(result.content), 0, 0);
      }

      return new Text(formatResultText(d, expanded, theme), 0, 0);
    },
  });
}
