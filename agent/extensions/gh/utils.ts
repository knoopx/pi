import type { ChildProcess } from "node:child_process";
import { spawn as nodeSpawn } from "node:child_process";

/** Type of the child_process.spawn function */
type SpawnFn = typeof nodeSpawn;

/**
 * Execute gh CLI command and return output
 */
export async function ghCmd(
  args: string[],
  options?: { stdio?: "inherit" | "pipe" },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { spawn } = await import("node:child_process");
  return executeGhCommand(spawn, args, {
    stdio: options?.stdio === "inherit" ? "inherit" : "pipe",
  });
}

/**
 * Collect stdout and stderr from a process stream
 */
function collectProcessOutput(
  proc: ChildProcess,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });

    proc.on("error", (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Execute gh CLI command and collect output
 */
function executeGhCommand(
  spawn: SpawnFn,
  args: string[],
  options: { stdio?: "inherit" | "pipe" },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = spawn("gh", args, {
    stdio: options.stdio === "inherit" ? "inherit" : "pipe",
  });
  return collectProcessOutput(proc);
}

/**
 * Parse JSON output from gh CLI command
 */
function parseGhJsonOutput<T>(
  result: { stdout: string; stderr: string; exitCode: number },
  commandName: string,
): T {
  if (result.exitCode !== 0)
    throw new Error(
      `gh ${commandName} failed: ${result.stderr || result.stdout}`,
    );

  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(
      `Failed to parse gh ${commandName} output: ${result.stdout}`,
    );
  }
}

/**
 * Execute gh CLI command and parse JSON output
 */
export async function ghCmdJson<T>(
  args: string[],
  commandName: string,
): Promise<T> {
  const result = await ghCmd(args);
  return parseGhJsonOutput<T>(result, commandName);
}

/**
 * Execute gh CLI command with stdin input and parse JSON output
 */
export async function ghCmdJsonWithInput<T>(
  args: string[],
  input: unknown,
  commandName: string,
): Promise<T> {
  const { spawn } = await import("node:child_process");
  const result = await executeGhCommandWithInput(spawn, args, input);
  return parseGhJsonOutput<T>(result, commandName);
}

/**
 * Execute gh CLI command with stdin input and collect output
 */
function executeGhCommandWithInput(
  spawn: SpawnFn,
  args: string[],
  input: unknown,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = spawn("gh", args, { stdio: ["pipe", "pipe", "pipe"] });
  proc.stdin.write(JSON.stringify(input));
  proc.stdin.end();
  return collectProcessOutput(proc);
}
