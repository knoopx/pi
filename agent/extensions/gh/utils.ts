/**
 * Execute gh CLI command and return output
 */
export async function ghCmd(
  args: string[],
  options?: { stdio?: "inherit" | "pipe" },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { spawn } = await import("node:child_process");
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>(
    (resolve, reject) => {
      const proc = spawn("gh", args, {
        stdio: options?.stdio === "inherit" ? "inherit" : "pipe",
      });

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

      proc.on("error", (err) => {
        reject(err);
      });
    },
  );
}
