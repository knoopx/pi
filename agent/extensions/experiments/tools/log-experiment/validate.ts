import { Type } from "typebox";
import type {
  ASI,
  ExperimentResult,
  ExperimentState,
} from "../../lib/state";

export const LogParams = Type.Object({
  commit: Type.String({ description: "Git commit hash (short, 7 chars)" }),
  metric: Type.Number({
    description:
      "The primary optimization metric value (e.g. seconds, val_bpb). 0 for crashes.",
  }),
  status: Type.Union([
    Type.Literal("keep"),
    Type.Literal("discard"),
    Type.Literal("crash"),
    Type.Literal("checks_failed"),
  ]),
  description: Type.String({
    description: "Short description of what this experiment tried",
  }),
  metrics: Type.Optional(
    Type.Object(
      {},
      {
        additionalProperties: Type.Number(),
        description:
          'Additional metrics to track as { name: value } pairs, e.g. { "compile_µs": 4200, "render_µs": 9800 }. These are shown alongside the primary metric for tradeoff monitoring.',
      },
    ),
  ),
  force: Type.Optional(
    Type.Boolean({
      description:
        "Set to true to allow adding a new secondary metric that wasn't tracked before. Only use for metrics that have proven very valuable to watch.",
    }),
  ),
  asi: Type.Optional(
    Type.Object(
      {},
      {
        additionalProperties: Type.Unknown(),
        description:
          "Actionable Side Information — structured diagnostics for this run. Free-form key/value pairs. Parsed ASI from experiment-run output is merged automatically; use this to add or override fields.",
      },
    ),
  ),
});

export interface LogDetails {
  experiment: ExperimentResult;
  state: ExperimentState;
  wallClockSeconds: number | null;
}

export function validateSecondaryMetrics(
  params: { metrics?: unknown; force?: boolean },
  state: ExperimentState,
): string | null {
  const secondaryMetrics = (params.metrics as Record<string, number>) ?? {};
  if (state.secondaryMetrics.length === 0) return null;

  const knownNames = new Set(state.secondaryMetrics.map((m) => m.name));
  const providedNames = new Set(Object.keys(secondaryMetrics));

  const missing = [...knownNames].filter((n) => !providedNames.has(n));
  if (missing.length > 0) {
    return `❌ Missing secondary metrics: ${missing.join(", ")}\n\nYou must provide all previously tracked metrics. Expected: ${[...knownNames].join(", ")}\nGot: ${[...providedNames].join(", ") || "(none)"}\n\nFix: include ${missing.map((m) => `"${m}": <value>`).join(", ")} in the metrics parameter.`;
  }

  const newMetrics = [...providedNames].filter((n) => !knownNames.has(n));
  if (newMetrics.length > 0 && !params.force) {
    return `❌ New secondary metric${newMetrics.length > 1 ? "s" : ""} not previously tracked: ${newMetrics.join(", ")}\n\nExisting metrics: ${[...knownNames].join(", ")}\n\nIf this metric has proven very valuable to watch, call experiment-log again with force: true to add it. Otherwise, remove it from the metrics parameter.`;
  }
  return null;
}

export function buildExperimentResult(
  params: {
    commit: string;
    metric: number;
    status: "keep" | "discard" | "crash" | "checks_failed";
    description: string;
    asi?: unknown;
  },
  secondaryMetrics: Record<string, number>,
  state: ExperimentState,
): ExperimentResult {
  const mergedASI =
    params.asi && Object.keys(params.asi as Record<string, unknown>).length > 0
      ? (params.asi as ASI)
      : undefined;
  return {
    commit: params.commit.slice(0, 7),
    metric: params.metric,
    metrics: secondaryMetrics,
    status: params.status,
    description: params.description,
    timestamp: Date.now(),
    segment: state.currentSegment,
    confidence: null,
    asi: mergedASI,
  };
}
