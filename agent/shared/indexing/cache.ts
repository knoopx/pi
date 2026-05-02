import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolve } from "node:path";

export interface IndexedSection {
  source?: string;
  skill?: string;
  file: string;
  section: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface FileIndexEntry {
  mtimes: Record<string, number>;
  chunks: IndexedSection[];
}

const DEFAULT_CACHE_DIR = resolve(homedir(), ".cache", "pi-index");
const DEFAULT_CACHE_FILE = join(DEFAULT_CACHE_DIR, "index.json");

export async function loadCache(
  cacheFile: string = DEFAULT_CACHE_FILE,
): Promise<FileIndexEntry | null> {
  try {
    const raw = await readFile(cacheFile, "utf-8");
    return JSON.parse(raw) as FileIndexEntry;
  } catch {
    return null;
  }
}

export async function saveCache(
  entry: FileIndexEntry,
  cacheFile: string = DEFAULT_CACHE_FILE,
): Promise<void> {
  const dir = join(cacheFile, "..");
  await mkdir(dir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(entry), "utf-8");
}
