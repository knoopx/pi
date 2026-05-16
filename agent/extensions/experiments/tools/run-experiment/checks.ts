import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export async function runChecks(
  pi: ExtensionAPI,
  workDir: string,
  checksPath: string,
  checksTimeout: number,
  signal: AbortSignal | undefined,
): Promise<{
  pass: boolean | null;
  timedOut: boolean;
  output: string;
  duration: number;
}> {
  const ct0 = Date.now();
  try {
    const checksResult = await pi.exec("bash", [checksPath], {
      signal,
      timeout: checksTimeout,
      cwd: workDir,
    });
    const duration = (Date.now() - ct0) / 1000;
    return {
      pass: checksResult.code === 0 && !checksResult.killed,
      timedOut: !!checksResult.killed,
      output: (checksResult.stdout + "\n" + checksResult.stderr).trim(),
      duration,
    };
  } catch (e) {
    return {
      pass: false,
      timedOut: false,
      output: e instanceof Error ? e.message : String(e),
      duration: (Date.now() - ct0) / 1000,
    };
  }
}
