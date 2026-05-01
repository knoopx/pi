export interface HitChunk {
  file: string;
  section: string;
  score: number;
  text: string;
}

export interface HitEntry {
  skill: string;
  chunks: HitChunk[];
}

export function formatHits(
  hits: HitEntry[],
  extra?: (chunk: HitChunk) => string[],
): string {
  const lines: string[] = [];

  for (const hit of hits) {
    for (const c of hit.chunks) {
      lines.push(`\`${c.file}\`: ${c.section}`);
      if (extra) {
        lines.push(...extra(c));
      }
    }
  }

  return lines.join("\n").trim();
}

export function buildReminder(hits: HitEntry[]): string {
  return formatHits(hits, (c) => {
    const preview = c.text.trim().slice(0, 200);
    return [
      `\`\`\`
${preview}
\`\`\``,
    ];
  });
}
