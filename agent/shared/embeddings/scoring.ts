import { cosine } from "./engine";

export function deduplicateAndRank<T>(
  scored: T[],
  keyFn: (item: T) => string,
  maxResults: number,
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const hit of scored) {
    const key = keyFn(hit);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(hit);
    }
  }
  return deduped.slice(0, maxResults);
}
