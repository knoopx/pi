import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";

/**
 * Strip OSC (Operating System Command) sequences from text.
 * These sequences (like OSC 8 hyperlinks: \x1b]8;;URL\x1b\\ or \x1b]8;;URL\x07)
 * are not always properly handled by string-width/strip-ansi.
 */
// eslint-disable-next-line no-control-regex
const OSC_FULL_PATTERN = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\|\x1b(?=\[))?/g;
// eslint-disable-next-line no-control-regex
const OSC_BARE_URL_PATTERN = /\]8;;[^\x07\x1b\]\s]*(?=\]8;;)/g;
const OSC_BARE_MARKER_PATTERN = /\]8;;/g;

function stripOscSequences(text: string): string {
  // OSC sequences: \x1b] ... (terminated by \x1b\\ or \x07 or just \x1b followed by other escape)
  // Also handle malformed sequences like ]8;; that appear without proper escape prefix
  return text
    .replace(OSC_FULL_PATTERN, "")
    .replace(OSC_BARE_URL_PATTERN, "") // Strip ]8;;URL stopping before next ]8;;
    .replace(OSC_BARE_MARKER_PATTERN, ""); // Remove remaining bare ]8;; markers
}

/** Truncate text to width, preserving ANSI codes */
export function truncateAnsi(text: string, width: number): string {
  const cleaned = stripOscSequences(text);
  if (stringWidth(cleaned) <= width) return cleaned;
  return sliceAnsi(cleaned, 0, width);
}

/**
 * Load file preview using bat with syntax highlighting.
 * Shared across files-component and symbols-component.
 */
export async function loadFilePreviewWithBat(
  pi: ExtensionAPI,
  filePath: string,
  cwd: string,
): Promise<string[]> {
  const result = await pi.exec("bat", ["--plain", "--color=always", filePath], {
    cwd,
  });
  if (result.code === 0) {
    return result.stdout.split("\n");
  }
  return [`Error reading file: ${result.stderr}`];
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

/**
 * Build help text from conditional items
 * Usage: buildHelpText("tab ↑↓ nav", hasFiles && "e edit", canDelete && "x delete")
 */
export function buildHelpText(
  ...items: (string | false | null | undefined)[]
): string {
  return items.filter(Boolean).join(" • ");
}

export function formatBookmarkReference(
  theme: Theme,
  bookmark: string,
): string {
  return theme.fg("accent", `<${bookmark}>`);
}
