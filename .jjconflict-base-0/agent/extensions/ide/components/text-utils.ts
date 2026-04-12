import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";
import type { Theme } from "@mariozechner/pi-coding-agent";

const OSC_FULL_PATTERN =
  /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\|\u001b(?=\[))?/g;
const OSC_BARE_URL_PATTERN = /\]8;;[^\u0007\u001b\]\s]*(?=\]8;;)/g;
const OSC_BARE_MARKER_PATTERN = /\]8;;/g;

function stripOscSequences(text: string): string {
  return text
    .replace(OSC_FULL_PATTERN, "")
    .replace(OSC_BARE_URL_PATTERN, "")
    .replace(OSC_BARE_MARKER_PATTERN, "");
}

/** Truncate text to width, preserving ANSI codes */
export function truncateAnsi(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  if (stringWidth(cleaned) <= width) return cleaned;
  return sliceAnsi(cleaned, 0, width);
}

/** Pad text to exact width, truncating if necessary */
export function pad(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  const len = stringWidth(cleaned);
  if (len >= width) return sliceAnsi(cleaned, 0, width);
  return cleaned + " ".repeat(width - len);
}

/** Ensure line is exactly the specified width */
export function ensureWidth(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  const currentWidth = stringWidth(cleaned);
  if (currentWidth === width) return cleaned;
  if (currentWidth > width) return sliceAnsi(cleaned, 0, width);
  return cleaned + " ".repeat(width - currentWidth);
}

/** Build help text from conditional items */
export function buildHelpText(
  ...items: (string | false | null | undefined)[]
): string {
  return items.filter(Boolean).join(" • ");
}

/**
 * Render a list row with optional selection highlighting and status styling.
 * Handles truncation, width padding, and theme application.
 */
export function renderListRow(
  text: string,
  width: number,
  isSelected: boolean,
  isCurrent?: boolean,
  theme?: Theme,
): string {
  const truncated = truncateAnsi(text, width);
  const final = ensureWidth(truncated, width);

  if (isSelected && theme) {
    const styled = theme.fg("accent", theme.bold(final));
    return theme.bg("selectedBg", styled);
  }
  if (isCurrent && theme) {
    return theme.fg("warning", final);
  }
  return final;
}
