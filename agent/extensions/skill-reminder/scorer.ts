import { cosine } from "../../shared/embeddings/engine";
import { deduplicateAndRank } from "../../shared/embeddings/scoring";
import type { HitChunk } from "./reminder";
import type { IndexedSection } from "../../shared/indexing/cache";
import type { Config } from "./config";

export function scoreAndRank(
  index: IndexedSection[],
  queryEmbedding: number[],
  config: Config,
  _queryText?: string,
): HitChunk[] {
  const scored = index
    .map<HitChunk | null>((chunk) => ({
      score: cosine(queryEmbedding, chunk.embedding),
      skill: chunk.skill,
      file: chunk.file,
      section: chunk.section,
      text: chunk.text,
    }))
    .filter(
      (s): s is HitChunk =>
        s.score > config.scoreThreshold && s.skill !== undefined,
    );

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);
  return deduplicateAndRank(
    scored,
    (h) => `${h.file}#${h.section}`,
    config.maxSkills,
  );
}
