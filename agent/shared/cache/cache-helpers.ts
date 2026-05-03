import { stat } from "node:fs/promises";

export interface CachedResult<T> {
  mtimes: Record<string, number>;
  chunks: T[];
}

export async function tryLoadCached<T>(
  files: string[],
  loadCache: () => Promise<CachedResult<T> | null>,
): Promise<T[] | null> {
  const cached = await loadCache();
  if (cached && !(await isCacheStale(cached.mtimes, files))) {
    return cached.chunks;
  }
  return null;
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
