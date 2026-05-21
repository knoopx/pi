import { spawn, type SpawnOptions } from "node:child_process";

export interface SpawnChildOptions {
  /** If provided, write this buffer to stdin and use pipe stdio. */
  data?: Buffer;
}

function extractAbortReason(signal: AbortSignal): string {
  if (typeof signal.reason === "string") return signal.reason;
  if (signal.reason instanceof Error) return signal.reason.message;
  return "Aborted";
}

function buildStdioConfig(hasData: boolean): SpawnOptions["stdio"] {
  return hasData ? ["pipe", "pipe", "pipe"] : ["inherit", "pipe", "pipe"];
}

function setupAbortHandler(
  signal: AbortSignal,
  child: ReturnType<typeof spawn>,
  reject: (reason: unknown) => void,
): void {
  signal.addEventListener("abort", () => {
    child.kill("SIGTERM");
    reject(new Error("Aborted"));
  });
}

function writeStdin(data: Buffer, stdin: NodeJS.WritableStream): void {
  stdin.write(data);
  stdin.end();
}

function checkInitialAbort(signal: AbortSignal | undefined): Error | null {
  if (signal?.aborted) return new Error(extractAbortReason(signal));
  return null;
}

function configureChildProcess(
  child: ReturnType<typeof spawn>,
  signal: AbortSignal | undefined,
  options: SpawnChildOptions & { signal?: AbortSignal },
  reject: (reason: unknown) => void,
): void {
  if (signal) setupAbortHandler(signal, child, reject);
  if (options?.data && child.stdin) writeStdin(options.data, child.stdin);
}

function setupOutputCapture(
  child: ReturnType<typeof spawn>,
  buffers: { stdout: string; stderr: string },
): void {
  child.stdout?.on("data", (chunk: Buffer) => {
    buffers.stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    buffers.stderr += chunk.toString();
  });
}

export function spawnChild(
  cmd: string,
  args: string[],
  options?: SpawnChildOptions & { signal?: AbortSignal },
): Promise<string> {
  const signal = options?.signal;
  return new Promise((resolve, reject) => {
    const abortError = checkInitialAbort(signal);
    if (abortError) return reject(abortError);

    const child = spawn(cmd, args, {
      stdio: buildStdioConfig(!!options?.data),
    } as SpawnOptions);

    if (options) {
      configureChildProcess(child, signal, options, reject);
    }

    const buffers = { stdout: "", stderr: "" };
    setupOutputCapture(child, buffers);

    child.on("close", (code: number | null) => {
      handleChildClose(code, cmd, args, buffers, resolve, reject);
    });
    child.on("error", reject);
  });
}

function handleChildClose(
  code: number | null,
  cmd: string,
  args: string[],
  buffers: { stdout: string; stderr: string },
  resolve: (value: string) => void,
  reject: (reason: unknown) => void,
): void {
  if (code === 0) {
    resolve(buffers.stdout.trim());
  } else {
    reject(
      new Error(
        `${cmd} ${args.join(" ")} failed (exit ${code}): ${buffers.stderr.trim()}`,
      ),
    );
  }
}
