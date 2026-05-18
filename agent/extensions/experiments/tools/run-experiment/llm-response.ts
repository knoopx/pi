import type { TruncationResult } from "@earendil-works/pi-coding-agent";
import { formatSize } from "@earendil-works/pi-coding-agent";
import { formatNum } from "../../lib/metrics";

const EXPERIMENT_MAX_BYTES = 4 * 1024;

export function buildLlmResponse(
  output: string,
  timedOut: boolean,
  exitCode: number | null,
  benchmarkPassed: boolean,
  checksPass: boolean | null,
  checksTimedOut: boolean,
  checksDuration: number,
  durationSeconds: number,
  parsedMetricMap: Map<string, number>,
  state: {
    metricName: string;
    metricUnit: string;
    bestMetric: number | null;
    secondaryMetrics: Array<{ name: string; unit: string }>;
  },
  llmTruncation: TruncationResult,
  fullOutputPath: string | undefined,
  checksOutput: string,
): string {
  const lines: string[] = [];

  lines.push(
    buildStatusLine(
      timedOut,
      exitCode,
      benchmarkPassed,
      checksPass,
      checksTimedOut,
      checksDuration,
      durationSeconds,
    ),
  );

  if (state.bestMetric !== null) {
    lines.push(
      `󰂀 Current best ${state.metricName}: ${formatNum(state.bestMetric, state.metricUnit)}`,
    );
  }

  const metricsSection = buildMetricsSection(parsedMetricMap, state);
  if (metricsSection) lines.push(metricsSection);

  lines.push(llmTruncation.content);

  const truncationNote = buildTruncationNote(llmTruncation, fullOutputPath);
  if (truncationNote) lines.push(truncationNote);

  if (checksPass === false) {
    lines.push(
      `\n── Checks output (last 80 lines) ──\n${checksOutput.split("\n").slice(-80).join("\n")}`,
    );
  }

  return lines.join("\n");
}

function buildStatusLine(
  timedOut: boolean,
  exitCode: number | null,
  benchmarkPassed: boolean,
  checksPass: boolean | null,
  checksTimedOut: boolean,
  checksDuration: number,
  durationSeconds: number,
): string {
  if (timedOut) {
    return `󰥔 TIMEOUT after ${durationSeconds.toFixed(1)}s\n`;
  }
  if (!benchmarkPassed) {
    return `󰚑 FAILED (exit code ${exitCode}) in ${durationSeconds.toFixed(1)}s\n`;
  }
  if (checksTimedOut) {
    return (
      [
        `󰄬 Benchmark PASSED in ${durationSeconds.toFixed(1)}s`,
        `󰥔 CHECKS TIMEOUT (experiment.checks.sh) after ${checksDuration.toFixed(1)}s`,
        `Log this as 'checks_failed' — the benchmark metric is valid but checks timed out.`,
      ].join("\n") + "\n"
    );
  }
  if (checksPass === false) {
    return (
      [
        `󰄬 Benchmark PASSED in ${durationSeconds.toFixed(1)}s`,
        `󰚑 CHECKS FAILED (experiment.checks.sh) in ${checksDuration.toFixed(1)}s`,
        `Log this as 'checks_failed' — the benchmark metric is valid but correctness checks did not pass.`,
      ].join("\n") + "\n"
    );
  }
  let text = `󰄬 PASSED in ${durationSeconds.toFixed(1)}s\n`;
  if (checksPass === true) {
    text += `󰄬 Checks passed in ${checksDuration.toFixed(1)}s\n`;
  }
  return text;
}

function buildMetricsSection(
  parsedMetricMap: Map<string, number>,
  state: {
    metricName: string;
    metricUnit: string;
    secondaryMetrics: Array<{ name: string; unit: string }>;
  },
): string | null {
  if (parsedMetricMap.size === 0) return null;

  const parsedPrimary = parsedMetricMap.get(state.metricName) ?? null;
  const secondary = [...parsedMetricMap.entries()].filter(
    ([k]) => k !== state.metricName,
  );

  let section = `\n󰂀 Parsed metrics:`;
  if (parsedPrimary !== null) {
    section += ` ★ ${state.metricName}=${formatNum(parsedPrimary, state.metricUnit)}`;
  }
  section += formatSecondaryMetrics(secondary, state.secondaryMetrics);
  section += `\nUse these values directly in experiment-log (metric:  ${parsedPrimary ?? "?"}, metrics: {${secondary.map(([k, v]) => `"${k}": ${v}`).join(", ")}})\n`;
  return section;
}

function formatSecondaryMetrics(
  secondary: [string, number][],
  knownMetrics: Array<{ name: string; unit: string }>,
): string {
  let text = "";
  for (const [name, value] of secondary) {
    const unit = knownMetrics.find((m) => m.name === name)?.unit ?? "";
    text += ` ${name}=${formatNum(value, unit)}`;
  }
  return text;
}

function buildTruncationNote(
  llmTruncation: TruncationResult,
  fullOutputPath: string | undefined,
): string | null {
  if (!llmTruncation.truncated) return null;

  let note = "\n";
  if (llmTruncation.truncatedBy === "lines") {
    note += `[Showing last ${llmTruncation.outputLines} of ${llmTruncation.totalLines} lines.`;
  } else {
    note += `[Showing last ${llmTruncation.outputLines} lines (${formatSize(EXPERIMENT_MAX_BYTES)} limit).`;
  }
  if (fullOutputPath) {
    note += ` Full output: ${fullOutputPath}`;
  }
  note += `]`;
  return note;
}
