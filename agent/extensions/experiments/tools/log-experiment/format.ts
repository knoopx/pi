import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import type { ASI, ExperimentResult, ExperimentState } from "../../lib/state";
import {
  findBaselineSecondary,
  findBestMetric,
  formatNum,
} from "../../lib/metrics";

function formatMetricWithBaseline(
  name: string,
  value: number,
  baseline: number | undefined,
  unit: string,
  hasMultipleResults: boolean,
): string {
  let part = `${name}: ${formatNum(value, unit)}`;
  if (baseline !== undefined && hasMultipleResults && baseline !== 0) {
    const d = value - baseline;
    const p = ((d / baseline) * 100).toFixed(1);
    part += ` (${d > 0 ? "+" : ""}${p}%)`;
  }
  return part;
}

function formatSecondaryMetrics(
  secondaryMetrics: Record<string, number>,
  state: ExperimentState,
): string {
  const baselines = findBaselineSecondary(
    state.results,
    state.currentSegment,
    state.secondaryMetrics,
  );
  const hasMultiple = state.results.length > 1;
  return Object.entries(secondaryMetrics)
    .map(([name, value]) => {
      const def = state.secondaryMetrics.find((m) => m.name === name);
      return formatMetricWithBaseline(
        name,
        value,
        baselines[name],
        def?.unit ?? "",
        hasMultiple,
      );
    })
    .join("  ");
}

function formatASI(asi: ASI): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(asi)) {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    parts.push(`${k}: ${s.length > 80 ? s.slice(0, 77) + "…" : s}`);
  }
  return parts.join(" | ");
}

function formatConfidence(confidence: number): string {
  const confStr = confidence.toFixed(1);
  if (confidence >= 2.0)
    return `▪ Confidence: ${confStr}× noise floor — improvement is likely real`;
  if (confidence >= 1.0)
    return `▪ Confidence: ${confStr}× noise floor — improvement is above noise but marginal`;
  return `⚠ Confidence: ${confStr}× noise floor — improvement is within noise. Consider re-running to confirm before keeping.`;
}

function statusColor(status: string): "success" | "error" | "warning" {
  if (status === "keep") return "success";
  if (status === "crash") return "error";
  return "warning";
}

function statusIcon(status: string): string {
  switch (status) {
    case "keep":
      return "✔";
    case "discard":
      return "✘";
    case "crash":
      return "☠";
    case "checks_failed":
      return "⛔";
    default:
      return "?";
  }
}

const noopTheme: Theme = {
  fg: (_color: ThemeColor, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  underline: (text: string) => text,
  inverse: (text: string) => text,
  strikethrough: (text: string) => text,
  getFgAnsi: () => "",
  getBgAnsi: () => "",
  getColorMode: () => "truecolor",
  getThinkingBorderColor: () => (t: string) => t,
  getBashModeBorderColor: () => (t: string) => t,
} as unknown as Theme;

function formatComparison(
  result: ExperimentResult,
  state: ExperimentState,
  theme: Theme,
): string {
  const bestMetric = findBestMetric(state.results, state.currentSegment);
  if (
    bestMetric === null ||
    result.metric <= bestMetric ||
    state.bestDirection !== "lower"
  ) {
    return "";
  }
  const d = result.metric - bestMetric;
  const p = ((d / bestMetric) * 100).toFixed(1);
  return theme.fg("warning", ` (worse than best: +${p}%)`);
}

function appendKeyValue<T extends Record<string, unknown>>(
  text: string,
  obj: T,
  formatter: (v: T) => string,
  colorFn: (text: string) => string,
): string {
  if (!obj || Object.keys(obj).length === 0) return text;
  return `${text}  ${colorFn(formatter(obj))}`;
}

export function buildLogText(
  result: ExperimentResult,
  state: ExperimentState,
  wallClockSeconds: number | null,
  secondaryMetrics: Record<string, number>,
  asi: ASI,
  theme: Theme = noopTheme,
): string {
  let text = `${statusIcon(result.status)} ${theme.bold(
    `experiment-log ${result.status} (${state.results.length})`,
  )}`;

  if (wallClockSeconds !== null) {
    text += theme.fg("dim", ` wall: ${wallClockSeconds.toFixed(1)}s`);
  }

  text += ` ${theme.fg(
    statusColor(result.status),
    `${state.metricName}: ${formatNum(result.metric, state.metricUnit)}`,
  )}`;

  text += formatComparison(result, state, theme);
  text = appendKeyValue(
    text,
    secondaryMetrics,
    (v) => formatSecondaryMetrics(v, state),
    (t) => theme.fg("dim", t),
  );
  text = appendKeyValue(text, asi, formatASI, (t) => theme.fg("muted", t));

  if (result.confidence !== null && result.confidence > 0) {
    text += "\n" + theme.fg("dim", formatConfidence(result.confidence));
  }

  return text;
}

export function buildLogTextPlain(
  result: ExperimentResult,
  state: ExperimentState,
  wallClockSeconds: number | null,
  secondaryMetrics: Record<string, number>,
  asi: ASI,
): string {
  return buildLogText(result, state, wallClockSeconds, secondaryMetrics, asi);
}
