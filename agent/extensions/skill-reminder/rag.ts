import { cosine } from "./embeddings";
import type { HitEntry } from "./formatter";
import type { IndexedChunk } from "./cache";
import type { SkillReminderConfig } from "./settings";

interface ScoredChunk {
  skill: string;
  file: string;
  section: string;
  text: string;
  score: number;
}

function groupBySkill(
  scored: ScoredChunk[],
): Map<string, Omit<ScoredChunk, "skill">[]> {
  return new Map(
    scored.reduce<Array<[string, Omit<ScoredChunk, "skill">[]]>>((acc, s) => {
      const key = s.skill;
      const existing = acc.find(([k]) => k === key);
      if (existing) {
        existing[1].push({
          file: s.file,
          section: s.section,
          score: s.score,
          text: s.text,
        });
      } else {
        acc.push([
          key,
          [{ file: s.file, section: s.section, score: s.score, text: s.text }],
        ]);
      }
      return acc;
    }, []),
  );
}

function groupSorted(
  scored: ScoredChunk[],
): Map<string, Omit<ScoredChunk, "skill">[]> {
  const bySkill = groupBySkill(scored);
  for (const chunks of bySkill.values()) {
    chunks.sort((a, b) => b.score - a.score);
  }
  return bySkill;
}

export function scoreAndRank(
  index: IndexedChunk[],
  queryEmbedding: number[],
  config: SkillReminderConfig,
  _queryText?: string,
): HitEntry[] {
  const scored = index
    .map<ScoredChunk>((chunk) => ({
      skill: chunk.skill,
      file: chunk.file,
      section: chunk.section,
      text: chunk.text,
      score: cosine(queryEmbedding, chunk.embedding),
    }))
    .filter((s) => s.score > config.scoreThreshold);

  if (scored.length === 0) return [];

  const bySkill = groupSorted(scored);
  return [...bySkill.entries()]
    .map(([skill, chunks]) => ({ skill, chunks }))
    .sort((a, b) => b.chunks[0].score - a.chunks[0].score)
    .slice(0, config.maxSkills);
}
