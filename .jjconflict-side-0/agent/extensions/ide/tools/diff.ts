import { codeToANSI } from "@shikijs/cli";
import type { BundledLanguage, BundledTheme } from "shiki";
import { createLRUCache } from "../../../shared/cache";
import { lang } from "./language";

const DEFAULT_THEME: BundledTheme = "github-dark";

/**
 * Get the Shiki theme from settings or environment variable
 */
export async function getTheme(
  pi: {
    exec: (
      cmd: string,
      args: string[],
      opts: { cwd: undefined },
    ) => Promise<{ code: number; stdout: string }>;
  },
  cwd: string,
): Promise<BundledTheme> {
  // Check environment variable first (for quick override)
  const envTheme = process.env.PRETTY_THEME as BundledTheme | undefined;
  if (envTheme) return envTheme;

  // Try to load from settings.json
  try {
    const result = await pi.exec("cat", [`${cwd}/agent/settings.json`], {
      cwd: undefined,
    });
    if (result.code !== 0) return DEFAULT_THEME;
    const settings = JSON.parse(result.stdout) as {
      ide?: { shikiTheme?: string };
    };
    const theme = settings.ide?.shikiTheme as BundledTheme | undefined;
    return theme ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

let addBg: string | null = null;
let removeBg: string | null = null;
let currentTheme: BundledTheme | null = null;

/**
 * Read terminal response until terminator or limit
 */
function readTerminalResponse(): Buffer {
  let response = Buffer.alloc(0);
  for (;;) {
    const chunk = Buffer.alloc(1);
    const n = process.stdin.read(chunk);
    if (n === null || n === 0) break;
    response = Buffer.concat([response, chunk.slice(0, n)]);
    if (
      response.endsWith(Buffer.from([0x1b, 0x5c])) ||
      response.endsWith(Buffer.from([0x07]))
    ) {
      break;
    }
    if (response.length > 256) break;
  }
  return response;
}

/**
 * Parse terminal color response into RGB tuple
 */
function parseColorResponse(response: Buffer): [number, number, number] | null {
  const str = response.toString("utf8");
  const match = str.match(
    /\x1b\]11;(rgb:[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+)(?:\x1b\\|\x07)/,
  );
  if (!match) return null;

  const [, color] = match;
  const [r, g, b] = color
    .slice(4)
    .split("/")
    .map((x: string) => parseInt(x, 16) >> 8);
  return [r, g, b];
}

/**
 * Query terminal for its background color using OSC sequence
 * Returns [r, g, b] or null if query fails
 */
function getTerminalBgColor(): [number, number, number] | null {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return null;

  try {
    const original = process.stdin.isRaw ?? false;
    if (!original) process.stdin.setRawMode(true);

    process.stdout.write("\x1b]11;?\x1b\\");
    const response = readTerminalResponse();

    if (!original) process.stdin.setRawMode(false);

    return parseColorResponse(response);
  } catch {
    return null;
  }
}

/**
 * Load theme directly and extract colors for diff backgrounds
 */
async function initShiki(theme: BundledTheme): Promise<void> {
  // Skip if already initialized with same theme
  if (addBg && removeBg && currentTheme === theme) return;

  // Load theme directly without initializing full highlighter
  const themeModule = await import(`@shikijs/themes/${theme}` as string);
  const themeData = themeModule.default;
  const colors = themeData.colors || {};

  // Use VS Code diff colors from the theme
  const green = colors["diffEditor.insertedTextBackground"];
  const red = colors["diffEditor.removedTextBackground"];

  // Convert hex (with alpha) to RGB with alpha blending
  const hexToRGBA = (hex: string): [number, number, number, number] => {
    const clean = hex.startsWith("#") ? hex.slice(1) : hex;
    // Handle 8-digit hex (with alpha)
    if (clean.length === 8) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const a = parseInt(clean.slice(6, 8), 16) / 255;
      return [r, g, b, a];
    }
    // Handle 6-digit hex (no alpha)
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b, 1];
  };

  // Blend semi-transparent diff color over solid background
  // Formula: result = fg * alpha + bg * (1 - alpha)
  // where alpha is the diff color's opacity (1 = opaque, 0 = transparent)
  const blend = (
    fg: [number, number, number, number],
    bg: [number, number, number],
  ): [number, number, number] => {
    const [fr, fg_, fb, fa] = fg;
    const [br, bg__, bb] = bg;
    const oneMinusAlpha = 1 - fa;
    return [
      Math.round(fr * fa + br * oneMinusAlpha),
      Math.round(fg_ * fa + bg__ * oneMinusAlpha),
      Math.round(fb * fa + bb * oneMinusAlpha),
    ];
  };

  const [gr, gg, gb, ga] = hexToRGBA(green);
  const [rr, rg, rb, ra] = hexToRGBA(red);

  // Query terminal for actual background color, fallback to black
  const terminalBg = getTerminalBgColor() ?? [0, 0, 0];
  const [blr, blg_, blb] = blend([gr, gg, gb, ga], terminalBg);
  const [blr_, blg__, blb_] = blend([rr, rg, rb, ra], terminalBg);

  // Use blended colors as backgrounds
  addBg = `\x1b[48;2;${blr};${blg_};${blb}m`;
  removeBg = `\x1b[48;2;${blr_};${blg__};${blb_}m`;
  currentTheme = theme;
}

const CACHE_LIMIT = 64;
const _cache = createLRUCache<string, string[]>(CACHE_LIMIT);

// Internal types for git diff parsing
interface DiffHunk {
  file: string;
  hunks: DiffHunkBlock[];
}

interface DiffHunkBlock {
  header: string;
  lines: DiffLine[];
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header" | "empty";
  content: string;
  lineNo?: number;
}

/**
 * Extract file name from diff --git line
 */
function extractFileNameFromDiffLine(line: string): string | null {
  const match = line.match(/diff --git "?(a\/)?(.+?)"?"?"?( b\/.+)?$/);
  if (!match) return null;
  const fileName = match[2]?.replace(/^a\//, "").replace(/^b\//, "");
  return fileName ?? null;
}

/**
 * Parse hunk header line to extract line numbers
 */
function parseHunkHeader(line: string): {
  removeLineNo: number;
  addLineNo: number;
} | null {
  const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;
  return {
    removeLineNo: parseInt(match[1], 10),
    addLineNo: parseInt(match[3], 10),
  };
}

/**
 * Parse an added line from diff
 */
function parseAddedLine(
  line: string,
  addLineNo: number | null,
): { line: DiffLine; addLineNo: number | null } | null {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return {
      line: {
        type: "add",
        content: line.slice(1),
        lineNo: addLineNo ?? undefined,
      },
      addLineNo: addLineNo !== null ? addLineNo + 1 : null,
    };
  }
  return null;
}

/**
 * Parse a removed line from diff
 */
function parseRemovedLine(
  line: string,
  removeLineNo: number | null,
): { line: DiffLine; removeLineNo: number | null } | null {
  if (line.startsWith("-") && !line.startsWith("---")) {
    return {
      line: {
        type: "remove",
        content: line.slice(1),
        lineNo: removeLineNo ?? undefined,
      },
      removeLineNo: removeLineNo !== null ? removeLineNo + 1 : null,
    };
  }
  return null;
}

/**
 * Parse a context line from diff
 */
function parseContextLine(
  line: string,
  addLineNo: number | null,
  removeLineNo: number | null,
): {
  line: DiffLine;
  addLineNo: number | null;
  removeLineNo: number | null;
} | null {
  if (line.startsWith(" ")) {
    return {
      line: {
        type: "context",
        content: line.slice(1),
        lineNo: removeLineNo ?? undefined,
      },
      addLineNo: addLineNo !== null ? addLineNo + 1 : null,
      removeLineNo: removeLineNo !== null ? removeLineNo + 1 : null,
    };
  }
  return null;
}

/**
 * Parse an empty line from diff
 */
function parseEmptyLine(): { line: DiffLine } | null {
  return { line: { type: "empty", content: "" } };
}

/**
 * Parse a single diff line into a DiffLine object
 */
function parseDiffLine(
  line: string,
  addLineNo: number | null,
  removeLineNo: number | null,
): {
  line: DiffLine;
  addLineNo: number | null;
  removeLineNo: number | null;
} | null {
  // Try parsing as added line
  const added = parseAddedLine(line, addLineNo);
  if (added) {
    return { ...added, removeLineNo };
  }

  // Try parsing as removed line
  const removed = parseRemovedLine(line, removeLineNo);
  if (removed) {
    return { ...removed, addLineNo };
  }

  // Try parsing as context line
  const context = parseContextLine(line, addLineNo, removeLineNo);
  if (context) {
    return context;
  }

  // Try parsing as empty line
  if (line === "") {
    const empty = parseEmptyLine();
    return { ...empty, addLineNo, removeLineNo };
  }

  return null;
}

/**
 * Parse git diff format into structured data
 */
/**
 * Check if line is a metadata line to skip
 */
function isMetadataLine(line: string): boolean {
  return (
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  );
}

/**
 * Handle diff --git line (new file)
 */
function handleGitLine(
  line: string,
  result: DiffHunk[],
): {
  currentFile: DiffHunk | null;
  currentHunk: DiffHunkBlock | null;
  addLineNo: number | null;
  removeLineNo: number | null;
} {
  const fileName = extractFileNameFromDiffLine(line);
  if (fileName) {
    const currentFile = { file: fileName, hunks: [] };
    result.push(currentFile);
    return {
      currentFile,
      currentHunk: null,
      addLineNo: null,
      removeLineNo: null,
    };
  }
  return {
    currentFile: null,
    currentHunk: null,
    addLineNo: null,
    removeLineNo: null,
  };
}

/**
 * Handle @@ hunk header line
 */
function handleHunkHeader(
  line: string,
  currentFile: DiffHunk | null,
): {
  currentHunk: DiffHunkBlock | null;
  addLineNo: number | null;
  removeLineNo: number | null;
} {
  const parsedHeader = parseHunkHeader(line);
  if (parsedHeader && currentFile) {
    const removeLineNo = parsedHeader.removeLineNo;
    const addLineNo = parsedHeader.addLineNo;
    const currentHunk = { header: line, lines: [] };
    currentFile.hunks.push(currentHunk);
    return { currentHunk, addLineNo, removeLineNo };
  }
  return { currentHunk: null, addLineNo: null, removeLineNo: null };
}

/**
 * Handle diff content line
 */
function handleDiffLine(
  line: string,
  currentHunk: DiffHunkBlock | null,
  addLineNo: number | null,
  removeLineNo: number | null,
): { addLineNo: number | null; removeLineNo: number | null } {
  if (!currentHunk) return { addLineNo, removeLineNo };
  const parsedLine = parseDiffLine(line, addLineNo, removeLineNo);
  if (parsedLine) {
    currentHunk.lines.push(parsedLine.line);
    return {
      addLineNo: parsedLine.addLineNo,
      removeLineNo: parsedLine.removeLineNo,
    };
  }
  return { addLineNo, removeLineNo };
}

function parseGitDiff(diff: string): DiffHunk[] {
  const result: DiffHunk[] = [];
  const lines = diff.split("\n");
  let currentFile: DiffHunk | null = null;
  let currentHunk: DiffHunkBlock | null = null;
  let addLineNo: number | null = null;
  let removeLineNo: number | null = null;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      const state = handleGitLine(line, result);
      currentFile = state.currentFile;
      currentHunk = state.currentHunk;
      addLineNo = state.addLineNo;
      removeLineNo = state.removeLineNo;
    } else if (isMetadataLine(line)) {
      // Skip metadata lines
    } else if (line.startsWith("@@")) {
      const state = handleHunkHeader(line, currentFile);
      currentHunk = state.currentHunk;
      addLineNo = state.addLineNo;
      removeLineNo = state.removeLineNo;
    } else {
      const state = handleDiffLine(line, currentHunk, addLineNo, removeLineNo);
      addLineNo = state.addLineNo;
      removeLineNo = state.removeLineNo;
    }
  }

  return result;
}

function _touch(k: string, v: string[]): string[] {
  return _cache.touch(k, v);
}

/**
 * Highlight a single line of code with Shiki
 */
async function highlightLine(
  content: string,
  language: BundledLanguage | undefined,
  theme: BundledTheme,
): Promise<string> {
  if (!language || !content) return content;

  const k = `${theme}\0${language}\0${content}`;
  const hit = _cache.get(k);
  if (hit) return _touch(k, hit).join("\n");

  try {
    const ansi = await codeToANSI(content, language, theme);
    const out = (ansi.endsWith("\n") ? ansi.slice(0, -1) : ansi).split("\n");
    return _touch(k, out).join("\n");
  } catch {
    return content;
  }
}

/**
 * Color diff line with Shiki theme background colors
 */
function colorDiffLine(line: DiffLine, highlightedContent: string): string {
  if (line.type === "add" && addBg) {
    return addBg + highlightedContent + "\x1b[0m";
  }
  if (line.type === "remove" && removeBg) {
    return removeBg + highlightedContent + "\x1b[0m";
  }
  return highlightedContent;
}

/**
 * Render diff with syntax highlighting using Shiki
 */
export async function renderDiffWithShiki(
  diff: string,
  theme: BundledTheme,
): Promise<string[]> {
  // Initialize Shiki to get theme colors
  await initShiki(theme);

  const parsed = parseGitDiff(diff);
  const output: string[] = [];

  for (const file of parsed) {
    const language = lang(file.file);

    for (const hunk of file.hunks) {
      // File header (first hunk only)
      if (file.hunks[0] === hunk) {
        output.push(`\x1b[1m${file.file}\x1b[0m`);
        output.push("");
      }

      // Hunk header (muted)
      output.push(`\x1b[90m${hunk.header}\x1b[0m`);

      // Diff lines
      for (const line of hunk.lines) {
        if (line.type === "empty") {
          output.push("");
          continue;
        }

        const highlighted = await highlightLine(line.content, language, theme);
        output.push(colorDiffLine(line, highlighted));
      }
    }

    output.push("");
  }

  return output;
}
