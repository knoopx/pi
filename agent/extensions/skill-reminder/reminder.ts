export interface HitChunk {
  score: number;
  skill: string;
  file: string;
  section: string;
  text: string;
}

export function formatHits(hits: HitChunk[]): string {
  return hits.map((c) => `${c.file} → ${c.section}`).join("\n");
}

export function buildReminder(hits: HitChunk[]): string {
  if (hits.length === 0) return "";
  return (
    "The following skill content may help resolve this error:\n\n" +
    formatHits(hits)
  );
}
