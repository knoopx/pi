export function hexColor(hex: string, text: string): string {
  const [r, g, b] = parseHexRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

export function parseHexRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function expandTabs(line: string, tabWidth = 8): string {
  let result = "";
  let col = 0;
  for (const char of line) {
    if (char === "\t") {
      const spaces = tabWidth - (col % tabWidth);
      result += " ".repeat(spaces);
      col += spaces;
    } else {
      result += char;
      col++;
    }
  }
  return result;
}
