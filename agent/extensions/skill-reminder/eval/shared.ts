import type { IndexedSection } from "../../../shared/indexing/cache";
import { loadSkillReminderCache as loadCache } from "../cache";
import { cosine } from "../../../shared/embeddings/engine";
import { loadConfig } from "../config";

export async function loadIndex(): Promise<IndexedSection[]> {
  const cached = await loadCache();
  if (!cached) {
    console.log("Cache not found, building index...");
    const { build } = await import("../indexer");
    const config = await loadConfig();
    return await build(config);
  }

  const skillCount = new Set(
    cached.chunks
      .map((chunk: IndexedSection) => chunk.skill)
      .filter((s): s is string => s !== undefined),
  ).size;
  console.log(
    `Loaded ${cached.chunks.length} chunks across ${skillCount} skills`,
  );
  return cached.chunks;
}

export function printMatches(index: IndexedSection[], embedding: number[]) {
  const scored = index
    .map<{
      skill: string | undefined;
      file: string;
      section: string;
      score: number;
    }>((chunk) => ({
      skill: chunk.skill,
      file: chunk.file,
      section: chunk.section,
      score: cosine(embedding, chunk.embedding),
    }))
    .filter(
      (s): s is Required<typeof s> & { skill: string } => s.skill !== undefined,
    )
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
