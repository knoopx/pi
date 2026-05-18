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
import * as fs from "node:fs";
import type { ExperimentRuntime } from "../../lib/state";
import { parseMetricLines } from "../../lib/metrics";
import { experimentChecksPath } from "../../lib/paths";
import {
  collectChildOutput,
  createChildProcess,
  createTempFileAllocator,
  type ChildOutputResult,
} from "./child-output";
import { runChecks } from "./checks";
import { buildLlmResponse } from "./llm-response";
import type { RunDetails } from "./render";
import { EXPERIMENT_MAX_BYTES, EXPERIMENT_MAX_LINES } from "./validation";
import { buildRunDetails } from "./status";

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
      pass: checksResult.pass ?? null,
      timedOut: checksResult.timedOut,
      duration: checksResult.duration,
      output: checksResult.output,
    };
  }
  return {
    pass: null,
    timedOut: false,
    duration: 0,
    output: "",
  };
}

export async function runExperimentCommand(
  ctx: RunExperimentContext,
): Promise<{ content: TextContent[]; details: RunDetails }> {
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
