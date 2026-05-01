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

export function spawnChild(
  cmd: string,
  args: string[],
  options?: SpawnChildOptions & { signal?: AbortSignal },
): Promise<string> {
  const signal = options?.signal;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error(extractAbortReason(signal)));
    }

    const child = spawn(cmd, args, {
      stdio: options?.data
        ? ["pipe", "pipe", "pipe"]
        : ["inherit", "pipe", "pipe"],
    } as SpawnOptions);

    if (signal) {
      signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        reject(new Error("Aborted"));
      });
    }

    if (options?.data && child.stdin) {
      child.stdin.write(options.data);
      child.stdin.end();
    }

    let stdout = "";
    let stderr = "";
    const onStreamData = (target: string, chunk: Buffer) => {
      if (target === "out") stdout += chunk.toString();
      else stderr += chunk.toString();
    };

    child.stdout?.on("data", (chunk: Buffer) => onStreamData("out", chunk));
    child.stderr?.on("data", (chunk: Buffer) => onStreamData("err", chunk));

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            `${cmd} ${args.join(" ")} failed (exit ${code}): ${stderr.trim()}`,
          ),
        );
      }
    });
    child.on("error", reject);
  });
}
