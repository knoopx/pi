import type { Theme } from "@mariozechner/pi-coding-agent";
import { ensureWidth } from "./text-utils";

/**
 * Apply hex color to text using ANSI true color (24-bit RGB).
 * Falls back to uncolored text if hex is invalid.
 */
function hexColor(hex: string, text: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return text;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

/** Apply focused styling to text, then pad to full width with background */
export function applyFocusedStyle(
  theme: Theme,
  text: string,
  isFocused: boolean,
  width?: number,
): string {
  if (isFocused) {
    const styled = theme.fg("accent", theme.bold(text));
    const padded = width !== undefined ? ensureWidth(styled, width) : styled;
    return theme.bg("selectedBg", padded);
  }
  return text;
}
