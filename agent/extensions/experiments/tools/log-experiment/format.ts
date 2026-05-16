import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import type { ASI, ExperimentResult, ExperimentState } from "../../lib/state";
import {
  findBaselineSecondary,
  findBestMetric,
  formatNum,
} from "../../lib/metrics";

function formatSecondaryMetrics(
  secondaryMetrics: Record<string, number>,
  state: ExperimentState,
): string {
  const baselines = findBaselineSecondary(
    state.results,
    state.currentSegment,
    state.secondaryMetrics,
  );
  const parts: string[] = [];
  for (const [name, value] of Object.entries(secondaryMetrics)) {
    const def = state.secondaryMetrics.find((m) => m.name === name);
    const unit = def?.unit ?? "";
    let part = `${name}: ${formatNum(value, unit)}`;
    const bv = baselines[name];
    if (bv !== undefined && state.results.length > 1 && bv !== 0) {
      const d = value - bv;
      const p = ((d / bv) * 100).toFixed(1);
      const s = d > 0 ? "+" : "";
      part += ` (${s}${p}%)`;
    }
    parts.push(part);
  }
  return parts.join("  ");
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
    return `📊 Confidence: ${confStr}× noise floor — improvement is likely real`;
  if (confidence >= 1.0)
    return `📊 Confidence: ${confStr}× noise floor — improvement is above noise but marginal`;
  return `⚠️ Confidence: ${confStr}× noise floor — improvement is within noise. Consider re-running to confirm before keeping.`;
}

function statusColor(status: string): "success" | "error" | "warning" {
  if (status === "keep") return "success";
  if (status === "crash") return "error";
  return "warning";
}

function statusIcon(status: string): string {
  switch (status) {
    case "keep":
      return "✅";
    case "discard":
      return "🗑️";
    case "crash":
      return "💥";
    case "checks_failed":
      return "🔴";
    default:
      return "❓";
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

export function buildLogText(
  result: ExperimentResult,
  state: ExperimentState,
  wallClockSeconds: number | null,
  secondaryMetrics: Record<string, number>,
  asi: ASI,
  theme: Theme = noopTheme,
): string {
  const bestMetric = findBestMetric(state.results, state.currentSegment);
  const results = state.results;

  let text = `${statusIcon(result.status)} ${theme.bold(
    `experiment-log ${result.status} (${results.length})`,
  )}`;

  if (wallClockSeconds !== null) {
    text += theme.fg("dim", ` wall: ${wallClockSeconds.toFixed(1)}s`);
  }

  text += ` ${theme.fg(
    statusColor(result.status),
    `${state.metricName}: ${formatNum(result.metric, state.metricUnit)}`,
  )}`;

  if (
    bestMetric !== null &&
    result.metric > bestMetric &&
    state.bestDirection === "lower"
  ) {
    const d = result.metric - bestMetric;
    const p = ((d / bestMetric) * 100).toFixed(1);
    text += theme.fg("warning", ` (worse than best: +${p}%)`);
  }

  if (Object.keys(secondaryMetrics).length > 0) {
    text += `  ${theme.fg("dim", formatSecondaryMetrics(secondaryMetrics, state))}`;
  }

  if (asi && Object.keys(asi).length > 0) {
    text += `  ${theme.fg("muted", formatASI(asi))}`;
  }

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
