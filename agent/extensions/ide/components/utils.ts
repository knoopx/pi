import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";

/** Apply focused styling to text */
export function applyFocusedStyle(
  theme: Theme,
  text: string,
  isFocused: boolean,
): string {
  return isFocused ? theme.fg("accent", theme.bold(text)) : text;
}

/** Symbol type icons for codemapper output (Nerd Font) */
const SYMBOL_TYPE_ICONS: Record<string, string> = {
  f: "󰊕", // function
  m: "󰆧", // method
  c: "󰠱", // class
  if: "󰰮", // interface
  ty: "󰗴", // type
  h: "󰉫", // heading
  cb: "󰅩", // code block
  e: "󰙅", // enum
  v: "󰀫", // variable
  function: "󰊕",
  method: "󰆧",
  class: "󰠱",
  interface: "󰰮",
  type: "󰗴",
  enum: "󰙅",
  variable: "󰀫",
  property: "󰜢",
  constant: "󰏿",
  module: "󰆧",
  namespace: "󰅩",
  struct: "󰙅",
};

/** Get icon for a symbol type, with fallback */
export function getSymbolIcon(type: string): string {
  return SYMBOL_TYPE_ICONS[type] || "󰈚";
}

export function formatSymbolListEntry(
  theme: Theme,
  opts: {
    type: string;
    name: string;
    path: string;
    line: number;
    signature?: string;
  },
): string {
  const icon = getSymbolIcon(opts.type);
  const pathShort = opts.path.replace(/^\.\//, "");
  const signatureText = opts.signature
    ? theme.fg("dim", ` ${opts.signature}`)
    : "";
  const location = theme.fg("dim", `${pathShort}:${String(opts.line)}`);
  return `${icon} ${opts.name}${signatureText} ${location}`;
}

/** File extension to Nerd Font icon mapping */
const FILE_ICONS: Record<string, string> = {
  // TypeScript/JavaScript
  ".ts": "󰛦",
  ".tsx": "󰜈",
  ".mts": "󰛦",
  ".cts": "󰛦",
  ".js": "󰌞",
  ".jsx": "󰜈",
  ".mjs": "󰌞",
  ".cjs": "󰌞",
  // Web
  ".html": "󰌝",
  ".css": "󰌜",
  ".scss": "󰌜",
  ".less": "󰌜",
  ".vue": "󰡄",
  ".svelte": "󰡄",
  // Data/Config
  ".json": "󰘦",
  ".yaml": "󰈙",
  ".yml": "󰈙",
  ".toml": "󰈙",
  ".xml": "󰈙",
  ".env": "󰈙",
  // Documentation
  ".md": "󰍔",
  ".mdx": "󰍔",
  ".txt": "󰈙",
  ".rst": "󰍔",
  // Languages
  ".py": "󰌠",
  ".rs": "󱘗",
  ".go": "󰟓",
  ".rb": "󰴭",
  ".php": "󰌟",
  ".java": "󰬷",
  ".kt": "󱈙",
  ".c": "󰙱",
  ".cpp": "󰙲",
  ".h": "󰙱",
  ".hpp": "󰙲",
  ".cs": "󰌛",
  ".swift": "󰛥",
  ".lua": "󰢱",
  ".sh": "󰆍",
  ".bash": "󰆍",
  ".zsh": "󰆍",
  ".fish": "󰆍",
  // Nix
  ".nix": "󱄅",
  // Images
  ".png": "󰋩",
  ".jpg": "󰋩",
  ".jpeg": "󰋩",
  ".gif": "󰋩",
  ".svg": "󰋩",
  ".ico": "󰋩",
  ".webp": "󰋩",
  // Git
  ".gitignore": "󰊢",
  ".gitmodules": "󰊢",
  ".gitattributes": "󰊢",
  // Lock files
  ".lock": "󰌾",
};

/** Special filenames to icon mapping */
const FILENAME_ICONS: Record<string, string> = {
  "package.json": "󰎙",
  "tsconfig.json": "󰛦",
  Dockerfile: "󰡨",
  "docker-compose.yml": "󰡨",
  "docker-compose.yaml": "󰡨",
  ".dockerignore": "󰡨",
  Makefile: "󱁤",
  "CMakeLists.txt": "󱁤",
  "flake.nix": "󱄅",
  "flake.lock": "󱄅",
  "Cargo.toml": "󱘗",
  "Cargo.lock": "󱘗",
  "go.mod": "󰟓",
  "go.sum": "󰟓",
  "requirements.txt": "󰌠",
  "pyproject.toml": "󰌠",
  Gemfile: "󰴭",
  "Gemfile.lock": "󰴭",
  LICENSE: "󰿃",
  "README.md": "󰍔",
  "CHANGELOG.md": "󰍔",
  "AGENTS.md": "󰍔",
};

/** File status icons (Nerd Font) */
const FILE_STATUS_ICONS: Record<string, string> = {
  A: "󰐕", // added
  M: "󰏫", // modified
  D: "󰍴", // deleted
  R: "󰑕", // renamed
  C: "󰆏", // copied
};

/** Get icon for file status (A/M/D/R/C) */
export function getFileStatusIcon(status: string): string {
  return FILE_STATUS_ICONS[status] || status;
}

/** Get Nerd Font icon for a file path */
export function getFileIcon(filePath: string): string {
  // Check for directory
  if (filePath.endsWith("/")) return "󰉋";

  // Extract filename
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1] || "";

  // Check special filenames first
  if (FILENAME_ICONS[filename]) {
    return FILENAME_ICONS[filename];
  }

  // Check extension
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = filename.slice(dotIndex).toLowerCase();
    if (FILE_ICONS[ext]) {
      return FILE_ICONS[ext];
    }
  }

  // Default file icon
  return "󰈙";
}

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
  return `${theme.fg("accent", "󰃀")} ${theme.fg("warning", bookmark)}`;
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
 * Format a change row with icon, selection marker, description, and bookmarks
 */
export function formatChangeRow(
  theme: Theme,
  opts: {
    isWorkingCopy: boolean;
    isEmpty: boolean;
    isSelected: boolean;
    isFocused?: boolean;
    bookmarks: string[];
    description: string;
  },
): { leftText: string; rightText: string } {
  const rawIcon = getChangeIcon(opts.isWorkingCopy, opts.isEmpty);
  const icon = opts.isSelected ? theme.fg("accent", rawIcon) : rawIcon;
  const bookmarkLabel = formatBookmarkLabels(theme, opts.bookmarks);

  const description = opts.isFocused
    ? theme.fg("accent", theme.bold(opts.description))
    : opts.description;
  const leftText = ` ${icon} ${bookmarkLabel}${description}`;

  return { leftText, rightText: "" };
}
