import { spawn } from "node:child_process";

type SpawnResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

type RunFn = (input: string) => Promise<SpawnResult>;

/**
 * Create a function that spawns a CLI tool with the given program
 * and argument template, capturing stdout/stderr for tests.
 */
function waitForStreamClose(
  stream: ReturnType<typeof spawn>["stdout"],
): Promise<void> {
  if (!stream) return Promise.resolve();
  return new Promise((r) => {
    if (stream.readableEnded) r();
    else stream.on("close", r);
  });
}

export function createRun(
  program: string,
  args: (input: string) => string[],
): RunFn {
  return (input) => {
    return new Promise((resolve) => {
      const child = spawn(program, args(input), { shell: false });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("exit", async (code) => {
        // Wait for streams to drain before resolving — prevents missing
        // trailing output when the process exits before pipes are flushed.
        await Promise.all([
          waitForStreamClose(child.stdout),
          waitForStreamClose(child.stderr),
        ]);
        resolve({ stdout, stderr, exitCode: code });
      });
    });
  };
}
