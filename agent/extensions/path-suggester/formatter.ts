import type { FileHit } from "./suggester";

export function formatSuggestions(hits: FileHit[]): string {
  if (hits.length === 0) return "";
  const lines = hits.map((h) => {
    const base = `${h.relPath} (${(h.score * 100).toFixed(0)}%)`;
    if (!h.symbols) return base;
    const indented = h.symbols
      .split(", ")
      .map((s) => `    ${s}`)
      .join("\n");
    return `${base}\n${indented}`;
  });
  return lines.join("\n");
}
