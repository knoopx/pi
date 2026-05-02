import { relative } from "node:path";
import { cosine } from "./embeddings";
import type { RawEntry } from "./file-index";
import type { PathSuggesterConfig } from "./settings";

export interface FileHit {
  score: number;
  path: string;
  relPath: string;
  symbols: string;
}

export function scoreAndRank(
  index: RawEntry[],
  queryEmbedding: number[],
  config: PathSuggesterConfig,
  projectDir: string,
): FileHit[] {
  // Score all entries and collect per-file best scores + threshold-passing symbols
  const fileScores = new Map<string, number>();
  const fileSymbols = new Map<string, string>();

  for (const entry of index) {
    const score = cosine(queryEmbedding, entry.embedding);
    const existing = fileScores.get(entry.path);
    if (existing === undefined || score > existing) {
      fileScores.set(entry.path, score);
    }
    // Only collect symbols from entries that pass the threshold
    if (entry.symbolText && score >= config.scoreThreshold) {
      const existingSymbols = fileSymbols.get(entry.path);
      if (!existingSymbols) {
        fileSymbols.set(entry.path, entry.symbolText);
      } else {
        fileSymbols.set(entry.path, `${existingSymbols}, ${entry.symbolText}`);
      }
    }
  }

  const scored: FileHit[] = [];
  for (const [path, score] of fileScores) {
    scored.push({
      score,
      path,
      relPath: relative(projectDir, path),
      symbols: fileSymbols.get(path) ?? "",
    });
  }

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);
  const filtered = scored.filter((h) => h.score >= config.scoreThreshold);
  return filtered.slice(0, config.maxSuggestions);
}
