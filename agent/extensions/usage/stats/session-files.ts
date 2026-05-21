import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

function checkSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}

export function getSessionsDir(): string {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "sessions");
}

function isJsonlFile(file: string): boolean {
  return file.endsWith(".jsonl");
}

async function collectSessionFiles(
  cwdPath: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (checkSignalAborted(signal)) return [];
  try {
    const sessionFiles = await readdir(cwdPath);
    return sessionFiles
      .filter((file) => isJsonlFile(file))
      .map((file) => join(cwdPath, file));
  } catch {
    return [];
  }
}

export async function getAllSessionFiles(
  signal?: AbortSignal,
): Promise<string[]> {
  const sessionsDir = getSessionsDir();
  if (checkSignalAborted(signal)) return [];
  try {
    const cwdDirs = await readdir(sessionsDir, { withFileTypes: true });
    return collectDirs(cwdDirs, sessionsDir, signal);
  } catch {
    return [];
  }
}

async function collectDirs(
  dirs: Dirent<string>[],
  sessionsDir: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const files: string[] = [];
  for (const dir of dirs) {
    if (checkSignalAborted(signal)) return files;
    if (!dir.isDirectory()) continue;
    const sessionFiles = await collectSessionFiles(
      join(sessionsDir, dir.name),
      signal,
    );
    files.push(...sessionFiles);
  }
  return files;
}
