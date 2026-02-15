import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import type { ListPickerComponent } from "./list-picker";
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

/**
 * Run a codemapper command and display output in picker preview
 */
export async function runCmCommand(
  pi: ExtensionAPI,
  picker: ListPickerComponent,
  cwd: string,
  command: string,
  args: string[],
): Promise<void> {
  const result = await pi.exec("cm", [command, ...args, "--format", "ai"], {
    cwd,
  });
  const output = result.code === 0 ? result.stdout : `Error: ${result.stderr}`;
  picker.setPreview(output.split("\n"));
}

/**
 * Format multiple bookmark references with proper spacing
 */
export function formatBookmarkLabels(
  theme: Theme,
  bookmarks: string[],
): string {
  if (bookmarks.length === 0) return "";
  return (
    bookmarks.map((b) => formatBookmarkReference(theme, b)).join(" ") + " "
  );
}

/**
 * Get jj-style change icon based on working copy and empty status
 * - ◉ working copy with content
 * - ◎ working copy, empty
 * - ● has content
 * - ○ empty
 */
export function getChangeIcon(
  isWorkingCopy: boolean,
  isEmpty: boolean,
): string {
  if (isWorkingCopy) {
    return isEmpty ? "◎" : "◉";
  }
  return isEmpty ? "○" : "●";
}

/**
 * Format a change row with icon, selection marker, bookmarks, and description
 */
export function formatChangeRow(
  theme: Theme,
  opts: {
    isWorkingCopy: boolean;
    isEmpty: boolean;
    isSelected: boolean;
    bookmarks: string[];
    description: string;
    changeId: string;
  },
): { leftText: string; rightText: string } {
  const icon = getChangeIcon(opts.isWorkingCopy, opts.isEmpty);
  const selectionMarker = opts.isSelected ? "▸" : " ";
  const bookmarkLabel = formatBookmarkLabels(theme, opts.bookmarks);
  const idLabel = opts.changeId.slice(0, 8);

  const leftText = ` ${selectionMarker}${icon} ${bookmarkLabel}${opts.description}`;
  const rightText = theme.fg("dim", ` ${idLabel}`);

  return { leftText, rightText };
}
