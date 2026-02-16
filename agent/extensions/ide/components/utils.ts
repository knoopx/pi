import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";

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

/** File extension to theme color mapping (IDE-style coloring) */
const FILE_ICON_COLORS: Record<string, string> = {
  // TypeScript/JavaScript - blue
  ".ts": "#3178c6",
  ".tsx": "#3178c6",
  ".mts": "#3178c6",
  ".cts": "#3178c6",
  ".js": "#f0db4f",
  ".jsx": "#61dafb",
  ".mjs": "#f0db4f",
  ".cjs": "#f0db4f",
  // Web - orange/pink
  ".html": "#e34c26",
  ".css": "#563d7c",
  ".scss": "#c6538c",
  ".less": "#1d365d",
  ".vue": "#41b883",
  ".svelte": "#ff3e00",
  // Data/Config - dim/gray
  ".json": "#cbcb41",
  ".yaml": "#cb171e",
  ".yml": "#cb171e",
  ".toml": "#9c4221",
  ".xml": "#e37933",
  ".env": "#ecd53f",
  // Documentation - green
  ".md": "#519aba",
  ".mdx": "#519aba",
  ".txt": "#89e051",
  ".rst": "#89e051",
  // Languages
  ".py": "#3572a5",
  ".rs": "#dea584",
  ".go": "#00add8",
  ".rb": "#cc342d",
  ".php": "#4f5d95",
  ".java": "#b07219",
  ".kt": "#a97bff",
  ".c": "#555555",
  ".cpp": "#f34b7d",
  ".h": "#555555",
  ".hpp": "#f34b7d",
  ".cs": "#178600",
  ".swift": "#f05138",
  ".lua": "#000080",
  ".sh": "#89e051",
  ".bash": "#89e051",
  ".zsh": "#89e051",
  ".fish": "#89e051",
  // Nix - blue
  ".nix": "#7ebae4",
  // Images - magenta
  ".png": "#a074c4",
  ".jpg": "#a074c4",
  ".jpeg": "#a074c4",
  ".gif": "#a074c4",
  ".svg": "#ffb13b",
  ".ico": "#a074c4",
  ".webp": "#a074c4",
  // Git - orange
  ".gitignore": "#f14e32",
  ".gitmodules": "#f14e32",
  ".gitattributes": "#f14e32",
  // Lock files - dim
  ".lock": "#6b7280",
};

/** Special filenames to color mapping */
const FILENAME_COLORS: Record<string, string> = {
  "package.json": "#cb3837",
  "tsconfig.json": "#3178c6",
  Dockerfile: "#384d54",
  "docker-compose.yml": "#384d54",
  "docker-compose.yaml": "#384d54",
  ".dockerignore": "#384d54",
  Makefile: "#6d8086",
  "CMakeLists.txt": "#6d8086",
  "flake.nix": "#7ebae4",
  "flake.lock": "#7ebae4",
  "Cargo.toml": "#dea584",
  "Cargo.lock": "#dea584",
  "go.mod": "#00add8",
  "go.sum": "#00add8",
  "requirements.txt": "#3572a5",
  "pyproject.toml": "#3572a5",
  Gemfile: "#cc342d",
  "Gemfile.lock": "#cc342d",
  LICENSE: "#d4af37",
  "README.md": "#519aba",
  "CHANGELOG.md": "#519aba",
  "AGENTS.md": "#519aba",
};

/** Get hex color for a file icon */
export function getFileIconColor(filePath: string): string | null {
  // Check for directory
  if (filePath.endsWith("/")) return "#90a4ae";

  // Extract filename
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1] || "";

  // Check special filenames first
  if (FILENAME_COLORS[filename]) {
    return FILENAME_COLORS[filename];
  }

  // Check extension
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = filename.slice(dotIndex).toLowerCase();
    if (FILE_ICON_COLORS[ext]) {
      return FILE_ICON_COLORS[ext];
    }
  }

  // Default - no specific color
  return null;
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
  return theme.inverse(theme.fg("accent", ` 󰃀 ${bookmark} `));
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
    isMoving?: boolean;
    bookmarks: string[];
    description: string;
    author?: string;
  },
): { leftText: string; rightText: string } {
  const rawIcon = getChangeIcon(opts.isWorkingCopy, opts.isEmpty);
  const icon = opts.isSelected ? theme.fg("accent", rawIcon) : rawIcon;
  const bookmarkLabel = formatBookmarkLabels(theme, opts.bookmarks);

  const moveIndicator = opts.isMoving ? theme.fg("warning", "↕ ") : "";
  const description = opts.isMoving
    ? theme.fg("warning", theme.bold(opts.description))
    : opts.isFocused
      ? theme.fg("accent", theme.bold(opts.description))
      : opts.description;
  const leftText = ` ${moveIndicator}${icon} ${bookmarkLabel}${description}`;

  const rightText = opts.author ? theme.fg("dim", ` ${opts.author}`) : "";

  return { leftText, rightText };
}
