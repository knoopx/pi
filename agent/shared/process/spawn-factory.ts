import { spawn } from "node:child_process";

type ExecParams = {
  onData: (chunk: Buffer) => void;
  signal?: AbortSignal | null;
  timeout?: number;
};

type ExecFn = (
  commandOrQuery: string,
  cwd: string,
  options: ExecParams,
) => Promise<{ exitCode: number | null }>;

type TimeoutState = {
  timedOut: boolean;
  handle: ReturnType<typeof setTimeout>;
};

function attachTimeout(
  child: ReturnType<typeof spawn>,
  timeout: number,
): { timedOut: boolean; handle: ReturnType<typeof setTimeout> } {
  let timedOut = false;
  const handle = setTimeout(() => {
    timedOut = true;
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* ESRCH: already exited */
      }
    }
  }, timeout * 1000);
  return { timedOut, handle };
}

function attachSignal(
  child: ReturnType<typeof spawn>,
  signal: AbortSignal,
): void {
  const onAbort = () => {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* ESRCH: already exited */
      }
    }
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
}

async function waitForExit(
  child: ReturnType<typeof spawn>,
): Promise<number | null> {
  return new Promise((resolve) => {
    child.on("exit", resolve);
    child.on("error", () => resolve(null));
  });
}

function waitForStreamClose(
  stream: ReturnType<typeof spawn>["stdout"],
): Promise<void> {
  if (!stream) return Promise.resolve();
  return new Promise((resolve) => {
    if (stream.readableEnded) resolve();
    else stream.on("close", resolve);
  });
}

function maybeAttachTimeout(
  child: ReturnType<typeof spawn>,
  timeout: number | undefined,
): TimeoutState | null {
  if (timeout === undefined || timeout <= 0) return null;
  return attachTimeout(child, timeout);
}

function checkAbort(signal: AbortSignal | null | undefined): void {
  if (!signal?.aborted) return;
  throw new Error("aborted");
}

function checkTimeout(
  timeoutState: TimeoutState | null,
  timeout: number | undefined,
): void {
  if (!timeoutState?.timedOut) return;
  throw new Error(`timeout:${timeout}`);
}

/**
 * Create an exec function that spawns a child process with the given
 * program and arguments. Handles timeout, abort signals, and streams
 * stdout/stderr via the onData callback.
 */
export function createExec(
  program: string,
  args: (commandOrQuery: string) => string[],
): ExecFn {
  return async (commandOrQuery, cwd, { onData, signal, timeout }) => {
    const child = spawn(program, args(commandOrQuery), {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeoutState = maybeAttachTimeout(child, timeout);

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    if (signal) attachSignal(child, signal);

    const exitCode = await waitForExit(child);

    // Drain stdout/stderr buffers before returning — prevents race where
    // late pipe data fires after the output accumulator is finished.
    await Promise.all([
      waitForStreamClose(child.stdout),
      waitForStreamClose(child.stderr),
    ]);

    cleanup(timeoutState);
    checkAbort(signal);
    checkTimeout(timeoutState, timeout);

    return { exitCode };
  };
}

function cleanup(timeoutState: TimeoutState | null): void {
  if (timeoutState) clearTimeout(timeoutState.handle);
}
