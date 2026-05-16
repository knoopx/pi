import {
  truncateTail,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import type { PartialRunDetails } from "./render";

export interface ChildOutputResult {
  exitCode: number | null;
  killed: boolean;
  output: string;
  tempFilePath: string | undefined;
  actualTotalBytes: number;
}

export function createTempFileAllocator(): () => string {
  let p: string | undefined;
  return () => {
    if (!p) {
      const id = randomBytes(8).toString("hex");
      p = path.join(tmpdir(), `pi-experiment-${id}.log`);
    }
    return p;
  };
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function killTree(pid: number): void {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process may have already exited
    }
  }
}

export function createChildProcess(
  command: string,
  workDir: string,
): ReturnType<typeof spawn> {
  return spawn("bash", ["-c", command], {
    cwd: workDir,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function collectChildOutput(
  child: ReturnType<typeof spawn>,
  t0: number,
  timeout: number,
  signal: AbortSignal | undefined,
  onUpdate?: (data: {
    content: Array<{ type: string; text?: string }>;
    details: PartialRunDetails;
  }) => void,
): Promise<ChildOutputResult> {
  const getTempFile = createTempFileAllocator();
  return new Promise((resolve, reject) => {
    let processTimedOut = false;
    const chunks: Buffer[] = [];
    let chunksBytes = 0;
    const maxChunksBytes = DEFAULT_MAX_BYTES * 2;
    let tempFilePath: string | undefined;
    let tempFileStream: ReturnType<typeof createWriteStream> | undefined;
    let totalBytes = 0;
    let chunksGeneration = 0;
    let cachedGeneration = -1;
    let cachedText = "";

    function getBufferText(): string {
      if (cachedGeneration === chunksGeneration) return cachedText;
      cachedText = Buffer.concat(chunks).toString("utf-8");
      cachedGeneration = chunksGeneration;
      return cachedText;
    }

    const handleData = (data: Buffer) => {
      totalBytes += data.length;
      if (totalBytes > DEFAULT_MAX_BYTES && !tempFilePath) {
        initTempFile();
      }
      if (tempFileStream) {
        tempFileStream.write(data);
      }
      addChunk(data);
      chunksGeneration++;
    };

    const initTempFile = () => {
      tempFilePath = getTempFile();
      tempFileStream = createWriteStream(tempFilePath);
      for (const chunk of chunks) {
        tempFileStream.write(chunk);
      }
    };

    const addChunk = (data: Buffer) => {
      chunks.push(data);
      chunksBytes += data.length;
      trimChunks();
    };

    const trimChunks = () => {
      while (chunksBytes > maxChunksBytes && chunks.length > 1) {
        const removed = chunks.shift()!;
        chunksBytes -= removed.length;
      }
      if (chunks.length > 0 && chunksBytes > maxChunksBytes) {
        const buf = chunks[0];
        const nlIdx = buf.indexOf(0x0a);
        if (nlIdx !== -1 && nlIdx < buf.length - 1) {
          chunks[0] = buf.subarray(nlIdx + 1);
          chunksBytes -= nlIdx + 1;
        }
      }
    };

    if (child.stdout) child.stdout.on("data", handleData);
    if (child.stderr) child.stderr.on("data", handleData);

    const timerInterval = setInterval(() => {
      if (!onUpdate) return;
      const elapsed = formatElapsed(Date.now() - t0);
      const trunc = truncateTail(getBufferText(), {
        maxLines: DEFAULT_MAX_LINES,
        maxBytes: DEFAULT_MAX_BYTES,
      });
      onUpdate({
        content: [{ type: "text", text: trunc.content || "" }],
        details: {
          phase: "running",
          elapsed,
          truncation: trunc.truncated ? trunc : undefined,
          fullOutputPath: tempFilePath,
        },
      });
    }, 1000);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (timeout > 0) {
      timeoutHandle = setTimeout(() => {
        processTimedOut = true;
        if (child.pid) killTree(child.pid);
      }, timeout);
    }

    const onAbort = () => {
      if (child.pid) killTree(child.pid);
      else {
        child.kill();
        child.once("spawn", () => {
          if (child.pid) killTree(child.pid);
        });
      }
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    child.on("error", (err) => {
      clearInterval(timerInterval);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (tempFileStream) tempFileStream.end();
      reject(err);
    });

    child.on("close", (code) => {
      clearInterval(timerInterval);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (tempFileStream) tempFileStream.end();
      if (signal?.aborted) {
        reject(new Error("aborted"));
        return;
      }
      const fullBuffer = Buffer.concat(chunks);
      resolve({
        exitCode: code,
        killed: processTimedOut,
        output: fullBuffer.toString("utf-8"),
        tempFilePath,
        actualTotalBytes: totalBytes,
      });
    });
  });
}
