import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";

/** Truncate text to width, preserving ANSI codes */
export function truncateAnsi(text: string, width: number): string {
  if (stringWidth(text) <= width) return text;
  return sliceAnsi(text, 0, width);
}

/** Pad text to exact width, truncating if necessary */
export function pad(text: string, width: number): string {
  const len = stringWidth(text);
  if (len >= width) return sliceAnsi(text, 0, width);
  return text + " ".repeat(width - len);
}

/** Ensure line is exactly the specified width */
export function ensureWidth(text: string, width: number): string {
  const currentWidth = stringWidth(text);
  if (currentWidth === width) return text;
  if (currentWidth > width) return sliceAnsi(text, 0, width);
  return text + " ".repeat(width - currentWidth);
}

/**
 * Build help text from conditional items
 * Usage: buildHelpText("tab ↑↓ nav", hasFiles && "e edit", canDelete && "x delete")
 */
export function buildHelpText(
  ...items: (string | false | null | undefined)[]
): string {
  return items.filter(Boolean).join(" • ");
}
