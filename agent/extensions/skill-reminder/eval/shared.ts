import type { IndexedSection } from "../../../shared/indexing/cache";
import { loadCache } from "../cache";
import { cosine } from "../../../shared/embeddings/engine";
import { loadConfig } from "../config";

export async function loadIndex(): Promise<IndexedSection[]> {
  const cached = await loadCache();
  if (!cached) {
    console.log("Cache not found, building index...");
    const { Indexer } = await import("../indexer");
    const config = await loadConfig();
    return await Indexer.build(config);
  }

  const skillCount = new Set(cached.chunks.map((c) => c.skill!)).size;
  console.log(
    `Loaded ${cached.chunks.length} chunks across ${skillCount} skills`,
  );
  return cached.chunks;
}

export function printMatches(index: IndexedSection[], embedding: number[]) {
  const scored = index
    .map((chunk) => ({
      skill: chunk.skill!,
      file: chunk.file,
      section: chunk.section,
      score: cosine(embedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  // Deduplicate by file + section, keeping the highest-scoring chunk.
  const seen = new Set<string>();
  const deduped = scored.filter((s) => {
    const key = `${s.file}#${s.section}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log("=== Top-10 Matches ===\n");
  for (const s of deduped.slice(0, 10)) {
    console.log(
      `${s.skill.padEnd(20)} ${s.score.toFixed(4)}  ${s.file} → ${s.section}`,
    );
  }
}
