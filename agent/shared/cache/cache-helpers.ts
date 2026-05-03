export function isCacheStale(
  cacheKeys: Record<string, unknown>,
  currentFiles: string[],
): boolean {
  // Check for new files not in cache — pure path comparison, no stat calls
  const cachedPaths = new Set(Object.keys(cacheKeys));
  for (const file of currentFiles) {
    if (!cachedPaths.has(file)) return true;
  }
  return false;
}
