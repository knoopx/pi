import type {
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  truncateTail,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@earendil-works/pi-coding-agent";
import type { TextContent } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import * as fs from "node:fs";
import type { ExperimentRuntime } from "../../lib/state";
import { parseMetricLines, formatNum } from "../../lib/metrics";
import { experimentChecksPath, experimentScriptPath } from "../../lib/paths";
import { ensureWorkDir } from "../../lib/config";
import {
  collectChildOutput,
  createChildProcess,
  createTempFileAllocator,
  type ChildOutputResult,
} from "./child-output";
import { runChecks } from "./checks";
import { buildLlmResponse } from "./llm-response";
import {
  renderPartialResult,
  buildSuccessHeader,
  formatTruncationNote,
  appendOutput,
  type RunDetails,
  type PartialRunDetails,
  type ThemeFn,
} from "./render";

const EXPERIMENT_MAX_LINES = 10;
const EXPERIMENT_MAX_BYTES = 4 * 1024;

const RunParams = Type.Object({
  command: Type.String({
    description:
      "Shell command to run (e.g. 'pnpm test:vitest', 'uv run train.py')",
  }),
  timeout_seconds: Type.Optional(
    Type.Number({ description: "Kill after this many seconds (default: 600)" }),
  ),
  checks_timeout_seconds: Type.Optional(
    Type.Number({
      description:
        "Kill experiment.checks.sh after this many seconds (default: 300). Only relevant when the checks file exists.",
    }),
  ),
});

function isExperimentShCommand(command: string): boolean {
  let cmd = command.trim();
  cmd = cmd.replace(/^(?:\w+=\S*\s+)+/, "");
  let prev: string;
  do {
    prev = cmd;
    cmd = cmd.replace(/^(?:env|time|nice|nohup)(?:\s+-\S+(?:\s+\d+)?)*\s+/, "");
  } while (cmd !== prev);
  return /^(?:(?:bash|sh|source)\s+(?:-\w+\s+)*)?(?:\.\/|\/[\w/.-]*\/)?experiment\.sh(?:\s|$)/.test(
    cmd,
  );
}

async function runChecksIfNeeded(
  benchmarkPassed: boolean,
  workDir: string,
  checksTimeoutSeconds: number | undefined,
  signal: AbortSignal | undefined,
  pi: ExtensionAPI,
): Promise<{
  pass: boolean | null;
  output: string;
  timedOut: boolean;
  duration: number;
} | null> {
  const checksPath = experimentChecksPath(workDir);
  if (!benchmarkPassed || !fs.existsSync(checksPath)) return null;

  const checksTimeout = (checksTimeoutSeconds ?? 300) * 1000;
  const result = await runChecks(
    pi,
    workDir,
    checksPath,
    checksTimeout,
    signal,
  );
  return {
    pass: result.pass,
    output: result.output,
    timedOut: result.timedOut,
    duration: result.duration,
  };
}

function resolveFullOutputPath(
  childResult: ChildOutputResult,
  output: string,
): string | undefined {
  let fullOutputPath: string | undefined = childResult.tempFilePath;
  const totalLines = output.split("\n").length;
  if (
    !fullOutputPath &&
    (childResult.actualTotalBytes > EXPERIMENT_MAX_BYTES ||
      totalLines > EXPERIMENT_MAX_LINES)
  ) {
    const getTempFile = createTempFileAllocator();
    fullOutputPath = getTempFile();
    fs.writeFileSync(fullOutputPath, output);
  }
  return fullOutputPath;
}

function parseMetrics(output: string, state: ExperimentRuntime["state"]) {
  const parsedMetricMap = parseMetricLines(output);
  const parsedPrimary = parsedMetricMap.get(state.metricName) ?? null;
  const parsedMetrics =
    parsedMetricMap.size > 0 ? Object.fromEntries(parsedMetricMap) : null;
  return { parsedMetricMap, parsedPrimary, parsedMetrics };
}

function successPrefix(
  d: RunDetails,
  parsedSuffix: string,
  theme: ThemeFn,
): string {
  return (
    theme.fg("success", `✅ wall: ${d.durationSeconds.toFixed(1)}s`) +
    parsedSuffix
  );
}

function getPlainText(
  content: Array<{ type?: string; text?: string }>,
): string {
  const t = content[0];
  return t?.type === "text" ? (t.text ?? "") : "";
}

function buildParsedSuffix(d: RunDetails, theme: ThemeFn): string {
  if (d.parsedPrimary === null) return "";
  return theme.fg(
    "accent",
    `, ${d.metricName}: ${formatNum(d.parsedPrimary, d.metricUnit)}`,
  );
}

function needsTruncationNote(d: RunDetails): boolean {
  return (d.truncation?.truncated === true ?? false) && !!d.fullOutputPath;
}

function buildStatusHeader(
  d: RunDetails,
  parsedSuffix: string,
  theme: ThemeFn,
): { text: string; outputToAppend: string | undefined } {
  if (d.timedOut) {
    return {
      text: theme.fg("error", `⏰ TIMEOUT ${d.durationSeconds.toFixed(1)}s`),
      outputToAppend: d.tailOutput,
    };
  }
  if (d.checksTimedOut || d.checksPass === false) {
    return {
      text:
        successPrefix(d, parsedSuffix, theme) +
        theme.fg(
          "error",
          ` ${d.checksTimedOut ? "⏰ checks timeout" : "💥 checks failed"} ${d.checksDuration.toFixed(1)}s`,
        ),
      outputToAppend: d.checksOutput,
    };
  }
  if (d.crashed) {
    return {
      text:
        theme.fg(
          "error",
          `💥 FAIL exit=${d.exitCode} ${d.durationSeconds.toFixed(1)}s`,
        ) + parsedSuffix,
      outputToAppend: d.tailOutput,
    };
  }
  return { text: buildSuccessHeader(d, theme), outputToAppend: d.tailOutput };
}

interface BuildRunDetailsOptions {
  command: string;
  exitCode: number | null;
  durationSeconds: number;
  passed: boolean;
  timedOut: boolean;
  tailOutput: string;
  checksResult: {
    pass: boolean;
    output: string;
    timedOut: boolean;
    duration: number;
  } | null;
  parsedMetrics: Record<string, number> | null;
  parsedPrimary: number | null;
  metricName: string;
  metricUnit: string;
  llmTruncation: { content: string; truncated: boolean };
  fullOutputPath: string | undefined;
}

function buildRunDetails(opts: BuildRunDetailsOptions) {
  const checks = resolveChecks(opts.checksResult);
  return {
    command: opts.command,
    exitCode: opts.exitCode,
    durationSeconds: opts.durationSeconds,
    passed: opts.passed,
    crashed: !opts.passed,
    timedOut: opts.timedOut,
    tailOutput: opts.tailOutput,
    checksPass: checks.pass,
    checksTimedOut: checks.timedOut,
    checksOutput: checks.output,
    checksDuration: checks.duration,
    parsedMetrics: opts.parsedMetrics,
    parsedPrimary: opts.parsedPrimary,
    metricName: opts.metricName,
    metricUnit: opts.metricUnit,
    truncation: opts.llmTruncation.truncated ? opts.llmTruncation : undefined,
    fullOutputPath: opts.fullOutputPath,
  };
}

function resolveChecks(
  result: {
    pass: boolean;
    output: string;
    timedOut: boolean;
    duration: number;
  } | null,
) {
  if (!result) return { pass: null, timedOut: false, output: "", duration: 0 };
  return {
    pass: result.pass,
    timedOut: result.timedOut,
    output: result.output.split("\n").slice(-80).join("\n"),
    duration: result.duration,
  };
}

function validateMaxExperiments(
  state: ExperimentRuntime["state"],
): string | null {
  if (state.maxExperiments === null) return null;
  const segCount = state.results.filter(
    (r) => r.segment === state.currentSegment,
  ).length;
  if (segCount >= state.maxExperiments) {
    return `🛑 Maximum experiments reached (${state.maxExperiments}). The experiment loop is done. To continue, call experiment-init to start a new segment.`;
  }
  return null;
}

function validateExperimentSh(workDir: string, command: string): string | null {
  const experimentShPath = experimentScriptPath(workDir);
  if (!fs.existsSync(experimentShPath) || isExperimentShCommand(command)) {
    return null;
  }
  return `❌ experiment.sh exists — you must run it instead of a custom command.

Found: ${experimentShPath}
Your command: ${command}

Use: experiment-run({ command: "bash experiment.sh" }) or experiment-run({ command: "./experiment.sh" })`;
}

function validateRunExperimentParams(
  params: { command: string; timeout_seconds?: number },
  state: ExperimentRuntime["state"],
  cwd: string,
):
  | { ok: true; workDir: string; timeout: number }
  | { ok: false; error: string } {
  const workDirResult = ensureWorkDir(cwd);
  if (!workDirResult.ok) return { ok: false, error: workDirResult.error };

  const maxError = validateMaxExperiments(state);
  if (maxError) return { ok: false, error: maxError };

  const shError = validateExperimentSh(workDirResult.workDir, params.command);
  if (shError) return { ok: false, error: shError };

  return {
    ok: true,
    workDir: workDirResult.workDir,
    timeout: (params.timeout_seconds ?? 600) * 1000,
  };
}

async function runChildProcess(
  command: string,
  workDir: string,
  timeout: number,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<unknown> | undefined,
  runtime: ExperimentRuntime,
  updateNotify: (ctx: ExtensionContext) => void,
  ctx: ExtensionContext,
): Promise<{ result: ChildOutputResult; durationSeconds: number }> {
  runtime.runningExperiment = {
    startedAt: Date.now(),
    command,
  };
  updateNotify(ctx);

  const t0 = Date.now();
  const child = createChildProcess(command, workDir);

  const result = await collectChildOutput(
    child,
    t0,
    timeout,
    signal,
    undefined,
  ).finally(() => {
    runtime.runningExperiment = null;
    updateNotify(ctx);
  });

  const durationSeconds = (Date.now() - t0) / 1000;
  runtime.lastRunDuration = durationSeconds;
  return { result, durationSeconds };
}

interface RunExperimentContext {
  params: { command: string; checks_timeout_seconds?: number };
  workDir: string;
  timeout: number;
  runtime: ExperimentRuntime;
  state: ExperimentRuntime["state"];
  signal: AbortSignal | undefined;
  onUpdate: AgentToolUpdateCallback<unknown> | undefined;
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  updateNotify: (ctx: ExtensionContext) => void;
}

function processChecksResult(
  checksResult: Awaited<ReturnType<typeof runChecksIfNeeded>>,
  runtime: ExperimentRuntime,
): {
  runtime: ExperimentRuntime;
  pass: boolean | null;
  timedOut: boolean;
  duration: number;
  output: string;
} {
  if (checksResult) {
    runtime.lastRunChecks = {
      pass: checksResult.pass ?? false,
      output: checksResult.output,
      duration: checksResult.duration,
    };
    return {
      runtime,
      pass: checksResult.pass ?? null,
      timedOut: checksResult.timedOut,
      duration: checksResult.duration,
      output: checksResult.output,
    };
  }
  return {
    runtime,
    pass: null,
    timedOut: false,
    duration: 0,
    output: "",
  };
}

async function runExperimentCommand(ctx: RunExperimentContext) {
  const { result: childResult, durationSeconds } = await runChildProcess(
    ctx.params.command,
    ctx.workDir,
    ctx.timeout,
    ctx.signal,
    ctx.onUpdate,
    ctx.runtime,
    ctx.updateNotify,
    ctx.ctx,
  );

  const benchmarkPassed = childResult.exitCode === 0 && !childResult.killed;

  const checksResult = await runChecksIfNeeded(
    benchmarkPassed,
    ctx.workDir,
    ctx.params.checks_timeout_seconds,
    ctx.signal,
    ctx.pi,
  );
  const checks = processChecksResult(checksResult, ctx.runtime);
  const passed = benchmarkPassed && (checks.pass === null || checks.pass);

  const fullOutputPath = resolveFullOutputPath(childResult, childResult.output);

  const displayTruncation = truncateTail(childResult.output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  const llmTruncation = truncateTail(childResult.output, {
    maxLines: EXPERIMENT_MAX_LINES,
    maxBytes: EXPERIMENT_MAX_BYTES,
  });

  const { parsedMetricMap, parsedPrimary, parsedMetrics } = parseMetrics(
    childResult.output,
    ctx.state,
  );

  const text = buildLlmResponse(
    childResult.output,
    childResult.killed,
    childResult.exitCode,
    benchmarkPassed,
    checks.pass,
    checks.timedOut,
    checks.duration,
    durationSeconds,
    parsedMetricMap,
    ctx.state,
    llmTruncation,
    fullOutputPath,
    checks.output,
  );

  const content: TextContent[] = [{ type: "text", text }];
  return {
    content,
    details: buildRunDetails({
      command: ctx.params.command,
      exitCode: childResult.exitCode,
      durationSeconds,
      passed,
      timedOut: childResult.killed,
      tailOutput: displayTruncation.content,
      checksResult: checksResult
        ? {
            pass: checksResult.pass ?? false,
            output: checksResult.output,
            timedOut: checksResult.timedOut,
            duration: checksResult.duration,
          }
        : null,
      parsedMetrics,
      parsedPrimary,
      metricName: ctx.state.metricName,
      metricUnit: ctx.state.metricUnit,
      llmTruncation,
      fullOutputPath,
    }),
  };
}

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

      const parsedSuffix = buildParsedSuffix(d, theme);
      const { text: headerText, outputToAppend } = buildStatusHeader(
        d,
        parsedSuffix,
        theme,
      );
      let text = appendOutput(headerText, outputToAppend, expanded, 5, theme);

      if (needsTruncationNote(d)) {
        text += "\n" + formatTruncationNote(d, theme);
      }

      return new Text(text, 0, 0);
    },
  });
}
