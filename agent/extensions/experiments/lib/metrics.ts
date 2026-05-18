import type { ExperimentResult, MetricDef } from "./state";

const METRIC_LINE_PREFIX = "METRIC";
const DENIED_METRIC_NAMES = new Set(["__proto__", "constructor", "prototype"]);

export function parseMetricLines(output: string): Map<string, number> {
  const metrics = new Map<string, number>();
  const regex = new RegExp(
    `^${METRIC_LINE_PREFIX}\\s+([\\w.µ]+)=(\\S+)\\s*$`,
    "gm",
  );
  let match;
  while ((match = regex.exec(output)) !== null) {
    const name = match[1];
    if (DENIED_METRIC_NAMES.has(name)) continue;
    const value = Number(match[2]);
    if (Number.isFinite(value)) {
      metrics.set(name, value);
    }
  }
  return metrics;
}

function commas(n: number): string {
  const s = String(Math.round(n));
  const parts: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    parts.unshift(s.slice(Math.max(0, i - 3), i));
  }
  return parts.join(",");
}

function fmtNum(n: number, decimals: number = 0): string {
  if (decimals > 0) {
    const int = Math.floor(Math.abs(n));
    const frac = (Math.abs(n) - int).toFixed(decimals).slice(1);
    return (n < 0 ? "-" : "") + commas(int) + frac;
  }
  return commas(n);
}

export function formatNum(value: number | null, unit: string): string {
  if (value === null) return "—";
  const u = unit || "";
  if (value === Math.round(value)) return fmtNum(value) + u;
  return fmtNum(value, 2) + u;
}

function isBetter(
  current: number,
  best: number,
  direction: "lower" | "higher",
): boolean {
  return direction === "lower" ? current < best : current > best;
}

function sortedMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function findBestKeptMetric(
  results: ExperimentResult[],
  direction: "lower" | "higher",
): number | null {
  let best: number | null = null;
  for (const r of results) {
    if (r.status === "keep" && r.metric > 0) {
      if (best === null || isBetter(r.metric, best, direction)) {
        best = r.metric;
      }
    }
  }
  return best;
}

export function computeConfidence(
  results: ExperimentResult[],
  segment: number,
  direction: "lower" | "higher",
): number | null {
  const cur = currentResults(results, segment).filter((r) => r.metric > 0);
  if (cur.length < 3) return null;

  const values = cur.map((r) => r.metric);
  const median = sortedMedian(values);
  const deviations = values.map((v) => Math.abs(v - median));
  const mad = sortedMedian(deviations);
  if (mad === 0) return null;

  const baseline = findBaselineMetric(results, segment);
  const bestKept = findBestKeptMetric(cur, direction);
  if (baseline === null || bestKept === null || bestKept === baseline) {
    return null;
  }

  return Math.abs(bestKept - baseline) / mad;
}

function currentResults(
  results: ExperimentResult[],
  segment: number,
): ExperimentResult[] {
  return results.filter((r) => r.segment === segment);
}

export function findBaselineMetric(
  results: ExperimentResult[],
  segment: number,
): number | null {
  const cur = currentResults(results, segment);
  return cur.length > 0 ? cur[0].metric : null;
}

export function findBestMetric(
  results: ExperimentResult[],
  segment: number,
): number | null {
  const segmentResults = currentResults(results, segment);
  const keptResults = segmentResults.filter((r) => r.status === "keep");
  return keptResults.sort((a, b) => a.metric - b.metric)[0]?.metric ?? null;
}

function fillMissingMetrics(
  base: Record<string, number>,
  knownMetrics: MetricDef[],
  results: ExperimentResult[],
): void {
  for (const sm of knownMetrics) {
    if (base[sm.name] !== undefined) continue;
    for (const r of results) {
      const val = (r.metrics ?? {})[sm.name];
      if (val !== undefined) {
        base[sm.name] = val;
        break;
      }
    }
  }
}

export function findBaselineSecondary(
  results: ExperimentResult[],
  segment: number,
  knownMetrics?: MetricDef[],
): Record<string, number> {
  const cur = currentResults(results, segment);
  const base: Record<string, number> =
    cur.length > 0 ? { ...(cur[0].metrics ?? {}) } : {};

  if (knownMetrics) {
    fillMissingMetrics(base, knownMetrics, cur);
  }

  return base;
}
