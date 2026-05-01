import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolve } from "node:path";

export interface IndexedChunk {
  skill: string;
  file: string;
  section: string;
  text: string;
  embedding: number[];
}

export interface CacheEntry {
  mtimes: Record<string, number>;
  chunks: IndexedChunk[];
}

const CACHE_DIR = resolve(homedir(), ".cache", "pi-skill-reminder");
const CACHE_FILE = join(CACHE_DIR, "index.json");

export async function loadCache(): Promise<CacheEntry | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

export async function saveCache(entry: CacheEntry): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(entry), "utf-8");
}

export async function isCacheStale(
  cachedMtimes: Record<string, number>,
  currentFiles: string[],
): Promise<boolean> {
  if (hasNewFiles(cachedMtimes, currentFiles)) return true;
  if (await hasModifiedFiles(cachedMtimes)) return true;
  return false;
}

function hasNewFiles(
  cachedMtimes: Record<string, number>,
  currentFiles: string[],
): boolean {
  const cachedPaths = new Set(Object.keys(cachedMtimes));
  for (const file of currentFiles) {
    if (!cachedPaths.has(file)) return true;
  }
  return false;
}

async function hasModifiedFiles(
  cachedMtimes: Record<string, number>,
): Promise<boolean> {
  for (const [file, cachedMtime] of Object.entries(cachedMtimes)) {
    try {
      const s = await stat(file);
      if (s.mtimeMs > cachedMtime) return true;
    } catch {
      return true;
    }
  }
  return false;
}
