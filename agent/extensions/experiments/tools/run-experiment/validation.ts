import { Type } from "typebox";
import * as fs from "node:fs";
import type { ExperimentRuntime } from "../../lib/state";
import { experimentScriptPath } from "../../lib/paths";
import { ensureWorkDir } from "../../lib/config";

export const EXPERIMENT_MAX_LINES = 10;
export const EXPERIMENT_MAX_BYTES = 4 * 1024;

export const RunParams = Type.Object({
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

function validateMaxExperiments(
  state: ExperimentRuntime["state"],
): string | null {
  if (state.maxExperiments === null) return null;
  const segCount = state.results.filter(
    (r) => r.segment === state.currentSegment,
  ).length;
  if (segCount >= state.maxExperiments) {
    return `󰓛 Maximum experiments reached (${state.maxExperiments}). The experiment loop is done. To continue, call experiment-init to start a new segment.`;
  }
  return null;
}

function validateExperimentSh(workDir: string, command: string): string | null {
  const experimentShPath = experimentScriptPath(workDir);
  if (!fs.existsSync(experimentShPath) || isExperimentShCommand(command)) {
    return null;
  }
  return `󰅗 experiment.sh exists — you must run it instead of a custom command.

Found: ${experimentShPath}
Your command: ${command}

Use: experiment-run({ command: "bash experiment.sh" }) or experiment-run({ command: "./experiment.sh" })`;
}

export function validateRunExperimentParams(
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
