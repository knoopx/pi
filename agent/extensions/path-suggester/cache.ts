import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolve } from "node:path";

interface CacheEntry {
  mtimes: Record<string, number>;
  chunks: unknown[];
}

const CACHE_DIR = resolve(homedir(), ".cache", "pi-path-suggester");
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
