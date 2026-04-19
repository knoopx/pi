import { codeToANSI } from "@shikijs/cli";
import { bundledThemes } from "shiki";
import type { BundledLanguage, BundledTheme } from "shiki";
import { createLRUCache } from "../../../shared/cache";
import { lang } from "./language";
let addBg: string | null = null;
let removeBg: string | null = null;
let currentTheme: BundledTheme | null = null;

function readTerminalResponse(): Buffer {
  let response = Buffer.alloc(0);
  for (;;) {
    const result: Buffer | null = process.stdin.read(1) as Buffer | null;
    if (result === null) break;
    if (result.length === 0) break;
    response = Buffer.concat([response, result]);
    const respStr = response.toString("hex");
    if (respStr.endsWith("1b5c") || respStr.endsWith("07")) break;
    if (response.length > 256) break;
  }
  return response;
}

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

async function initShiki(theme: BundledTheme): Promise<void> {
  if (addBg && removeBg && currentTheme === theme) return;

  const themeModule = await bundledThemes[theme]?.();
  const themeData = themeModule?.default;
  const colors = themeData?.colors || {};
  const green = colors["diffEditor.insertedTextBackground"];
  const red = colors["diffEditor.removedTextBackground"];
  const hexToRGBA = (hex: string): [number, number, number, number] => {
    const clean = hex.startsWith("#") ? hex.slice(1) : hex;
    if (clean.length === 8) {
      const hexR = parseInt(clean.slice(0, 2), 16);
      const hexG = parseInt(clean.slice(2, 4), 16);
      const hexB = parseInt(clean.slice(4, 6), 16);
      const hexA = parseInt(clean.slice(6, 8), 16) / 255;
      return [hexR, hexG, hexB, hexA];
    }
    const hexR2 = parseInt(clean.slice(0, 2), 16);
    const hexG2 = parseInt(clean.slice(2, 4), 16);
    const hexB2 = parseInt(clean.slice(4, 6), 16);
    return [hexR2, hexG2, hexB2, 1];
  };
  const blend = (
    fg: [number, number, number, number],
    bg: [number, number, number],
  ): [number, number, number] => {
    const [fgR, fgG, fgB, fgAlpha] = fg;
    const [bgR, bgG, bgB] = bg;
    const oneMinusAlpha = 1 - fgAlpha;
    return [
      Math.round(fgR * fgAlpha + bgR * oneMinusAlpha),
      Math.round(fgG * fgAlpha + bgG * oneMinusAlpha),
      Math.round(fgB * fgAlpha + bgB * oneMinusAlpha),
    ];
  };

  const [greenR, greenG, greenB, greenAlpha] = hexToRGBA(green);
  const [redR, redG, redB, redAlpha] = hexToRGBA(red);

  const terminalBg = getTerminalBgColor() ?? [0, 0, 0];
  const [addBgR, addBgG, addBgB] = blend(
    [greenR, greenG, greenB, greenAlpha],
    terminalBg,
  );
  const [removeBgR, removeBgG, removeBgB] = blend(
    [redR, redG, redB, redAlpha],
    terminalBg,
  );

  // Use blended colors as backgrounds
  addBg = `\x1b[48;2;${addBgR};${addBgG};${addBgB}m`;
  removeBg = `\x1b[48;2;${removeBgR};${removeBgG};${removeBgB}m`;
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

function extractFileNameFromDiffLine(line: string): string | null {
  const match = line.match(/diff --git "?(a\/)?(.+?)"?"?"?( b\/.+)?$/);
  if (!match) return null;
  const fileName = match[2]?.replace(/^a\//, "").replace(/^b\//, "");
  return fileName ?? null;
}

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

function parseAddedLine(
  line: string,
  addLineNo: number | null,
): { line: DiffLine; addLineNo: number | null } | null {
  if (line.startsWith("+") && !line.startsWith("+++"))
    return {
      line: {
        type: "add",
        content: line.slice(1),
        lineNo: addLineNo ?? undefined,
      },
      addLineNo: addLineNo !== null ? addLineNo + 1 : null,
    };
  return null;
}

function parseRemovedLine(
  line: string,
  removeLineNo: number | null,
): { line: DiffLine; removeLineNo: number | null } | null {
  if (line.startsWith("-") && !line.startsWith("---"))
    return {
      line: {
        type: "remove",
        content: line.slice(1),
        lineNo: removeLineNo ?? undefined,
      },
      removeLineNo: removeLineNo !== null ? removeLineNo + 1 : null,
    };
  return null;
}

function parseContextLine(
  line: string,
  addLineNo: number | null,
  removeLineNo: number | null,
): {
  line: DiffLine;
  addLineNo: number | null;
  removeLineNo: number | null;
} | null {
  if (line.startsWith(" "))
    return {
      line: {
        type: "context",
        content: line.slice(1),
        lineNo: removeLineNo ?? undefined,
      },
      addLineNo: addLineNo !== null ? addLineNo + 1 : null,
      removeLineNo: removeLineNo !== null ? removeLineNo + 1 : null,
    };
  return null;
}

function parseEmptyLine(): { line: DiffLine } | null {
  return { line: { type: "empty", content: "" } };
}

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
  if (added) return { ...added, removeLineNo };

  // Try parsing as removed line
  const removed = parseRemovedLine(line, removeLineNo);
  if (removed) return { ...removed, addLineNo };

  // Try parsing as context line
  const context = parseContextLine(line, addLineNo, removeLineNo);
  if (context) return context;

  // Try parsing as empty line
  if (line === "") {
    const empty = parseEmptyLine();
    if (empty) {
      return { ...empty, addLineNo, removeLineNo };
    }
  }

  return null;
}

function isMetadataLine(line: string): boolean {
  return (
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  );
}

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
    const { removeLineNo } = parsedHeader;
    const { addLineNo } = parsedHeader;
    const currentHunk = { header: line, lines: [] };
    currentFile.hunks.push(currentHunk);
    return { currentHunk, addLineNo, removeLineNo };
  }
  return { currentHunk: null, addLineNo: null, removeLineNo: null };
}

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

function colorDiffLine(line: DiffLine, highlightedContent: string): string {
  if (line.type === "add" && addBg)
    return `${addBg + highlightedContent}\x1b[0m`;
  if (line.type === "remove" && removeBg)
    return `${removeBg + highlightedContent}\x1b[0m`;
  return highlightedContent;
}

interface ProcessHunkOptions {
  hunk: DiffHunkBlock;
  file: DiffHunk;
  language: BundledLanguage | undefined;
  theme: BundledTheme;
  output: string[];
}

async function processHunk(options: ProcessHunkOptions): Promise<void> {
  const { hunk, file, language, theme, output } = options;
  if (file.hunks[0] === hunk) {
    output.push(`\x1b[1m${file.file}\x1b[0m`, "");
  }
  output.push(`\x1b[90m${hunk.header}\x1b[0m`);

  for (const line of hunk.lines) {
    if (line.type === "empty") {
      output.push("");
      continue;
    }
    const highlighted = await highlightLine(line.content, language, theme);
    output.push(colorDiffLine(line, highlighted));
  }
}

export async function renderDiffWithShiki(
  diff: string,
  theme: BundledTheme,
): Promise<string[]> {
  await initShiki(theme);
  const parsed = parseGitDiff(diff);
  const output: string[] = [];

  for (const file of parsed) {
    const language = lang(file.file);
    for (const hunk of file.hunks) {
      await processHunk({ hunk, file, language, theme, output });
    }
    output.push("");
  }

  return output;
}
