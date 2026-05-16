import * as fs from "node:fs";
import * as path from "node:path";
import { experimentConfigPath } from "./paths";

interface ExperimentConfig {
  maxIterations?: number;
  workingDir?: string;
}

function readConfig(cwd: string): ExperimentConfig {
  try {
    const configPath = experimentConfigPath(cwd);
    if (!fs.existsSync(configPath)) return {};
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

export function readMaxExperiments(cwd: string): number | null {
  const config = readConfig(cwd);
  return typeof config.maxIterations === "number" && config.maxIterations > 0
    ? Math.floor(config.maxIterations)
    : null;
}

export function resolveWorkDir(ctxCwd: string): string {
  const config = readConfig(ctxCwd);
  if (!config.workingDir) return ctxCwd;
  return path.isAbsolute(config.workingDir)
    ? config.workingDir
    : path.resolve(ctxCwd, config.workingDir);
}

export function ensureWorkDir(
  ctxCwd: string,
): { ok: false; error: string } | { ok: true; workDir: string } {
  const error = validateWorkDir(ctxCwd);
  if (error) return { ok: false, error: `❌ ${error}` };
  return { ok: true, workDir: resolveWorkDir(ctxCwd) };
}

function validateWorkDir(ctxCwd: string): string | null {
  const workDir = resolveWorkDir(ctxCwd);
  if (workDir === ctxCwd) return null;
  try {
    const stat = fs.statSync(workDir);
    if (!stat.isDirectory()) {
      return `workingDir "${workDir}" (from experiment.config.json) is not a directory.`;
    }
  } catch {
    return `workingDir "${workDir}" (from experiment.config.json) does not exist.`;
  }
  return null;
}
