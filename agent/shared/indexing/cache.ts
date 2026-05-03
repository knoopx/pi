import { createHash } from "node:crypto";
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
  digests: Record<string, string>;
  chunks: IndexedSection[];
}

function loadAndFilterCache<T>(
  cached: FileIndexEntry | null,
  fileDigests: Map<string, string>,
): { unchanged: string[]; stale: string[]; cleanedChunks: T[] } {
  const { unchanged, stale } = splitByDigest(fileDigests, cached?.digests);

  const currentPaths = new Set(fileDigests.keys());
  const cleanedChunks =
    (cached?.chunks as IndexedSection[])
      .filter((entry) => currentPaths.has(entry.file))
      .map((e) => e as unknown as T) ?? [];

  return { unchanged, stale, cleanedChunks };
}

function splitByDigest(
  fileDigests: Map<string, string>,
  cachedDigests?: Record<string, string>,
): { unchanged: string[]; stale: string[] } {
  if (!cachedDigests) return { unchanged: [], stale: [] };

  const unchanged: string[] = [];
  const stale: string[] = [];

  for (const [file, digest] of fileDigests) {
    if (cachedDigests[file] === digest) {
      unchanged.push(file);
    } else {
      stale.push(file);
    }
  }

  return { unchanged, stale };
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

export function fileDigest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function getChangedFiles(
  staleFiles: string[],
  unchangedFiles: string[],
): string[] {
  const unchangedPaths = new Set(unchangedFiles);
  return staleFiles.filter((f) => !unchangedPaths.has(f));
}

export async function runIndexBuild<T>(
  loadCacheFn: () => Promise<FileIndexEntry | null>,
  saveCacheFn: (entry: FileIndexEntry) => Promise<void>,
  fileDigests: Map<string, string>,
  rebuildFn: (
    stale: string[],
    cleanedChunks: T[],
    unchangedFiles: string[],
  ) => Promise<T[]>,
): Promise<T[]> {
  const cached = await loadCacheFn();
  const {
    unchanged: unchangedFiles,
    stale,
    cleanedChunks,
  } = loadAndFilterCache<T>(cached, fileDigests);

  let allChunks: T[] = [...cleanedChunks];

  if (stale.length > 0 || unchangedFiles.length < fileDigests.size) {
    allChunks = await rebuildFn(stale, cleanedChunks, unchangedFiles);
  }

  const newDigests = Object.fromEntries(fileDigests.entries());
  await saveCacheFn({
    digests: newDigests,
    chunks: allChunks as IndexedSection[],
  });

  return allChunks;
}
