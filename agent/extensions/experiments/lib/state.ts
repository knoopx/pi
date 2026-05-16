export interface ASI {
  [key: string]: unknown;
}

export interface ExperimentResult {
  commit: string;
  metric: number;
  metrics: Record<string, number>;
  status: "keep" | "discard" | "crash" | "checks_failed";
  description: string;
  timestamp: number;
  segment: number;
  confidence: number | null;
  asi?: ASI;
}

export interface MetricDef {
  name: string;
  unit: string;
}

export interface ExperimentState {
  results: ExperimentResult[];
  bestMetric: number | null;
  bestDirection: "lower" | "higher";
  metricName: string;
  metricUnit: string;
  secondaryMetrics: MetricDef[];
  name: string | null;
  currentSegment: number;
  maxExperiments: number | null;
  confidence: number | null;
}

export interface ExperimentRuntime {
  sessionId: string;
  experimentMode: boolean;
  experimentsThisSession: number;
  autoResumeTurns: number;
  lastRunChecks: { pass: boolean; output: string; duration: number } | null;
  lastRunDuration: number | null;
  runningExperiment: { startedAt: number; command: string } | null;
  state: ExperimentState;
  pendingResumeTimer: ReturnType<typeof setTimeout> | null;
  pendingResumeMessage: string | null;
}

export function createExperimentState(): ExperimentState {
  return {
    results: [],
    bestMetric: null,
    bestDirection: "lower",
    metricName: "metric",
    metricUnit: "",
    secondaryMetrics: [],
    name: null,
    currentSegment: 0,
    maxExperiments: null,
    confidence: null,
  };
}

function createSessionRuntime(sessionId: string): ExperimentRuntime {
  return {
    sessionId,
    experimentMode: false,
    experimentsThisSession: 0,
    autoResumeTurns: 0,
    lastRunChecks: null,
    lastRunDuration: null,
    runningExperiment: null,
    state: createExperimentState(),
    pendingResumeTimer: null,
    pendingResumeMessage: null,
  };
}

export function cloneExperimentState(state: ExperimentState): ExperimentState {
  return {
    ...state,
    results: state.results.map((result) => ({
      ...result,
      metrics: { ...result.metrics },
    })),
    secondaryMetrics: state.secondaryMetrics.map((metric) => ({ ...metric })),
  };
}

export class RuntimeStore {
  private runtimes = new Map<string, ExperimentRuntime>();

  has(sessionKey: string): boolean {
    return this.runtimes.has(sessionKey);
  }

  ensure(sessionKey: string): ExperimentRuntime {
    let runtime = this.runtimes.get(sessionKey);
    if (!runtime) {
      runtime = createSessionRuntime(sessionKey);
      this.runtimes.set(sessionKey, runtime);
    }
    return runtime;
  }

  clear(sessionKey: string): void {
    const runtime = this.runtimes.get(sessionKey);
    if (runtime?.pendingResumeTimer) {
      clearTimeout(runtime.pendingResumeTimer);
      runtime.pendingResumeTimer = null;
    }
    if (runtime) {
      runtime.pendingResumeMessage = null;
    }
    this.runtimes.delete(sessionKey);
  }

  // Cancel all pending timers across all runtimes (for shutdown when ctx is stale)
  cancelAllTimers(): void {
    for (const runtime of this.runtimes.values()) {
      if (runtime.pendingResumeTimer) {
        clearTimeout(runtime.pendingResumeTimer);
        runtime.pendingResumeTimer = null;
      }
      runtime.pendingResumeMessage = null;
    }
  }
}
