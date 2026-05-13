import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";

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

export function truncateAnsi(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  if (stringWidth(cleaned) <= width) return cleaned;
  return sliceAnsi(cleaned, 0, width);
}

export function pad(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  const len = stringWidth(cleaned);
  if (len >= width) return sliceAnsi(cleaned, 0, width);
  return cleaned + "\x1b[0m" + " ".repeat(width - len);
}

export function ensureWidth(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  const currentWidth = stringWidth(cleaned);
  if (currentWidth === width) return cleaned;
  if (currentWidth > width) return sliceAnsi(cleaned, 0, width);
  return cleaned + "\x1b[0m" + " ".repeat(width - currentWidth);
}

export function buildHelpText(
  ...items: (string | false | null | undefined)[]
): string {
  return items.filter(Boolean).join(" • ");
}
