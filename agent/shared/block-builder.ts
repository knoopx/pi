// Builds a markdown section from an array of entries, each with a heading and body.
export function buildSectionBlock<T extends { heading: string; body: string }>(
  title: string,
  items: T[],
): string {
  let out = `\n\n## ${title}\n`;
  for (const item of items) out += `\n### ${item.heading}\n${item.body}\n`;
  return out;
}
