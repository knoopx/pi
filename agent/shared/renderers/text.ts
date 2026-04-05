/**
 * Wrap plain text to lines of maxWidth, breaking at word boundaries.
 */
export function wrapPlain(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || text.length <= maxWidth) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);

  return lines.flatMap((line) => {
    if (line.length <= maxWidth) return [line];
    const chunks: string[] = [];
    for (let i = 0; i < line.length; i += maxWidth) {
      chunks.push(line.slice(i, i + maxWidth));
    }
    return chunks;
  });
}
