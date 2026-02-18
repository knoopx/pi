import type { Theme } from "@mariozechner/pi-coding-agent";

/**
 * Apply hex color to text using ANSI true color (24-bit RGB).
 * Falls back to uncolored text if hex is invalid.
 */
export function hexColor(hex: string, text: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return text;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

/** Apply focused styling to text */
export function applyFocusedStyle(
  theme: Theme,
  text: string,
  isFocused: boolean,
): string {
  return isFocused ? theme.fg("accent", theme.bold(text)) : text;
}
