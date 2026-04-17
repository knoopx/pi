/** Apply a 24-bit truecolor ANSI escape sequence to text */
export function hexColor(hex: string, text: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

/** Expand tabs to spaces */
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

/**
 * Base class for components that cache a single rendered line.
 * Subclasses implement `renderLine` to produce the actual content.
 */
export abstract class CachedRow {
  private width = 0;
  protected cachedLine: string | null = null;

  render(width: number): string[] {
    if (width === this.width && this.cachedLine !== null)
      return [this.cachedLine];
    this.width = width;
    this.cachedLine = this.renderLine(width);
    return [this.cachedLine];
  }

  invalidate(): void {
    this.cachedLine = null;
    this.width = 0;
  }

  dispose(): void {}

  protected abstract renderLine(width: number): string;
}

/**
 * Base class for components that cache an array of rendered lines.
 * Subclasses implement `renderContent` to produce the actual content.
 */
export abstract class CachedPane {
  private width = 0;
  protected cachedLines: string[] | null = null;

  render(width: number): string[] {
    if (width === this.width && this.cachedLines) return this.cachedLines;
    this.width = width;
    this.cachedLines = null;
    this.cachedLines = this.renderContent(width);
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.width = 0;
  }

  dispose(): void {}

  protected abstract renderContent(width: number): string[];
}
