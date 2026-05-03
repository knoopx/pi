import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

interface CacheEntry {
  digests: Record<string, string>;
  chunks: unknown[];
}

const CACHE_DIR = resolve(homedir(), ".cache", "pi-path-suggester");
const CACHE_FILE = join(CACHE_DIR, "index.json");

export async function loadPathSuggesterCache(): Promise<CacheEntry | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

export async function savePathSuggesterCache(entry: CacheEntry): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(entry), "utf-8");
}
