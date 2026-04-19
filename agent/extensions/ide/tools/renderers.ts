import type { Theme } from "@mariozechner/pi-coding-agent";
import { dirname, basename } from "node:path";
import { highlightCode } from "./shiki/highlight";
import { MAX_PREVIEW_LINES } from "./shiki-constants";
import { fileIconGlyph, dirIconGlyph } from "./icons";
import { termW } from "./terminal-utils";
import { lang } from "./language";

function skipAnsiEscape(code: string, pos: number): number {
  const end = code.indexOf("m", pos);
  return end !== -1 ? end + 1 : pos + 1;
}

function truncateAnsiLine(
  code: string,
  maxVisible: number,
  theme: Theme,
): string {
  if (code.length <= maxVisible) return code;
  const cut = findVisibleCut(code, maxVisible - 1);
  return `${code.slice(0, cut)}${theme.fg("muted", "›")}`;
}

function findVisibleCut(code: string, maxVis: number): number {
  let vis = 0;
  let j = 0;
  while (j < code.length && vis < maxVis) {
    if (code[j] === "\x1b") {
      j = skipAnsiEscape(code, j);
      continue;
    }
    vis++;
    j++;
  }
  return j;
}

interface FormatLineOptions {
  ln: number;
  code: string;
  nw: number;
  tw: number;
  theme: Theme;
}

function formatLineWithNumber(options: FormatLineOptions): string {
  const { ln, code, nw, tw, theme } = options;
  const display = truncateAnsiLine(code, tw - nw - 4, theme);
  const lnStr = " ".repeat(Math.max(0, nw - String(ln).length)) + ln;
  return `${theme.fg("muted", lnStr)} ${theme.fg("border", "│")} ${display}`;
}

interface RenderFileContentOptions {
  content: string;
  filePath: string;
  offset: number;
  maxLines: number;
  theme: Theme;
}

export async function renderFileContent(
  options: RenderFileContentOptions,
): Promise<string> {
  const { content, filePath, offset, maxLines, theme } = options;
  const lines = content.split("\n");
  const total = lines.length;
  const show = lines.slice(0, maxLines);
  const highlighted = await highlightFile(show, filePath, theme);

  const tw = termW();
  const rendered = renderHighlightedLines({
    hl: highlighted,
    fallback: show,
    offset,
    tw,
    theme,
  });

  return buildFilePreview({ lines: rendered, total, maxLines, tw, theme });
}

function highlightFile(
  lines: string[],
  filePath: string,
  theme: Theme,
): Promise<string[]> {
  const lg = lang(filePath);
  const mutedColor = theme.getFgAnsi("muted");
  return highlightCode(lines.join("\n"), lg, mutedColor);
}

function renderHighlightedLines(opts: {
  hl: string[];
  fallback: string[];
  offset: number;
  tw: number;
  theme: Theme;
}): string[] {
  const { hl, fallback, offset, tw, theme } = opts;
  const endLine = offset + hl.length - 1;
  const nw = Math.max(3, String(endLine).length);
  const out: string[] = [];

  for (let i = 0; i < hl.length; i++) {
    const ln = offset + i;
    const code = hl[i] ?? fallback[i] ?? "";
    out.push(formatLineWithNumber({ ln, code, nw, tw, theme }));
  }
  return out;
}

function buildFilePreview(opts: {
  lines: string[];
  total: number;
  maxLines: number;
  tw: number;
  theme: Theme;
}): string {
  const { lines, total, maxLines, tw, theme } = opts;
  const out = [theme.fg("border", "─".repeat(tw)), ...lines];
  out.push(theme.fg("border", "─".repeat(tw)));
  if (total > maxLines) {
    out.push(
      theme.fg("dim", `  … ${total - maxLines} more lines (${total} total)`),
    );
  }
  return out.join("\n");
}

function formatTreeEntry(entry: string, isLast: boolean, theme: Theme): string {
  const connector = theme.fg("border", isLast ? "└── " : "├── ");
  const label = formatEntryLabel(entry, theme);
  return `${connector}${label}`;
}

function formatEntryLabel(entry: string, theme: Theme): string {
  const { name, icon } = parseTreeEntry(entry);
  if (entry.endsWith("/")) {
    return theme.fg("accent", icon + name);
  }
  return icon + name;
}

function parseTreeEntry(entry: string): { name: string; icon: string } {
  const isDir = entry.endsWith("/");
  const name = isDir ? entry.slice(0, -1) : entry;
  const icon = isDir ? dirIconGlyph() : fileIconGlyph(name);
  return { name, icon };
}

export function renderTree(text: string, theme: Theme): string {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return theme.fg("dim", "(empty directory)");

  const total = lines.length;
  const show = lines.slice(0, MAX_PREVIEW_LINES);
  const isTruncated = total > MAX_PREVIEW_LINES;

  const out = renderTreeEntries(show, isTruncated, theme);
  if (isTruncated) {
    out.push(renderTruncationMessage(total - MAX_PREVIEW_LINES, theme));
  }
  return out.join("\n");
}

function renderTreeEntries(
  entries: string[],
  isTruncated: boolean,
  theme: Theme,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i].trim();
    const isLast = i === entries.length - 1 && !isTruncated;
    out.push(formatTreeEntry(entry, isLast, theme));
  }
  return out;
}

function renderTruncationMessage(remaining: number, theme: Theme): string {
  return `${theme.fg("border", "└── ")}${theme.fg("dim", `… ${remaining} more entries`)}`;
}

function groupFilesByDirectory(lines: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const trimmed = line.trim();
    const dir = dirname(trimmed) || ".";
    const file = basename(trimmed);
    const existing = groups.get(dir);
    if (existing) {
      existing.push(file);
    } else {
      groups.set(dir, [file]);
    }
  }
  return groups;
}

interface RenderDirFilesOptions {
  dir: string;
  files: string[];
  theme: Theme;
  maxCount: number;
  totalCount: number;
  totalLines: number;
}

function renderDirectoryFiles(options: RenderDirFilesOptions): {
  lines: string[];
  count: number;
} {
  const { files, theme, maxCount, totalCount, totalLines } = options;
  const out: string[] = [];
  let count = 0;

  for (let i = 0; i < files.length; i++) {
    if (totalCount + count >= maxCount) {
      out.push(
        theme.fg("dim", `  … ${totalLines - (totalCount + count)} more files`),
      );
      return { lines: out, count };
    }
    const isLast = i === files.length - 1;
    const prefix = isLast ? "└── " : "├── ";
    const icon = fileIconGlyph(files[i]);
    out.push(`  ${theme.fg("border", prefix)}${icon}${files[i]}`);
    count++;
  }

  return { lines: out, count };
}

export function renderFindResults(text: string, theme: Theme): string {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return theme.fg("dim", "(no matches)");

  const groups = groupFilesByDirectory(lines);
  const out: string[] = [];
  let count = 0;

  for (const [dir, files] of groups) {
    if (count > 0) out.push("");
    out.push(`${dirIconGlyph()}${theme.bold(theme.fg("accent", `${dir}/`))}`);
    const { lines: dirLines } = renderDirectoryFiles({
      dir,
      files,
      theme,
      maxCount: MAX_PREVIEW_LINES,
      totalCount: count,
      totalLines: lines.length,
    });
    out.push(...dirLines);
    count += dirLines.length;
  }

  return out.join("\n");
}

function createPatternHighlighter(
  pattern: string,
  theme: Theme,
): ((text: string) => string) | null {
  let re: RegExp | null;
  try {
    re = new RegExp(`(${pattern})`, "gi");
  } catch {
    return null;
  }
  return (text) => text.replace(re, theme.fg("warning", theme.bold("$1")));
}

function parseGrepLine(line: string): {
  file: string;
  lineNo: string;
  content: string;
} | null {
  const fileRe = /^(.+?)[:-](\d+)[:-](.*)$/;
  const match = fileRe.exec(line);
  if (!match) return null;
  const [, file, lineNo, content] = match;
  return { file, lineNo, content };
}

function renderGrepMatch(
  lineNo: string,
  content: string,
  highlighter: ((text: string) => string) | null,
  theme: Theme,
): string {
  const nw = Math.max(3, lineNo.length);
  let display = content;
  if (highlighter) display = highlighter(content);
  const lnStr = " ".repeat(Math.max(0, nw - lineNo.length)) + lineNo;
  return `  ${theme.fg("muted", lnStr)} ${theme.fg("border", "│")} ${display}`;
}

function processGrepLine(
  line: string,
  currentFile: string,
  highlighter: ((text: string) => string) | null,
  theme: Theme,
): { output: string[]; newFile: string; count: number } {
  const parsed = parseGrepLine(line);
  if (parsed)
    return buildGrepMatchOutput(parsed, currentFile, highlighter, theme);
  if (line.trim() === "--")
    return {
      output: [theme.fg("dim", "  ···")],
      newFile: currentFile,
      count: 0,
    };
  if (line.trim()) return { output: [line], newFile: currentFile, count: 1 };
  return { output: [], newFile: currentFile, count: 0 };
}

function buildGrepMatchOutput(
  parsed: { file: string; lineNo: string; content: string },
  currentFile: string,
  highlighter: ((text: string) => string) | null,
  theme: Theme,
): { output: string[]; newFile: string; count: number } {
  const { file, lineNo, content } = parsed;
  const out: string[] = [];
  if (file !== currentFile) {
    if (currentFile) out.push("");
    out.push(`${fileIconGlyph(file)}${theme.bold(theme.fg("accent", file))}`);
  }
  out.push(renderGrepMatch(lineNo, content, highlighter, theme));
  return { output: out, newFile: file, count: 1 };
}

export async function renderGrepResults(
  text: string,
  pattern: string,
  theme: Theme,
): Promise<string> {
  const lines = text.split("\n");
  if (isEmptyResult(lines)) return theme.fg("dim", "(no matches)");

  const highlighter = createPatternHighlighter(pattern, theme);
  const out = await processGrepLines(lines, highlighter, theme);
  return out.join("\n");
}

function isEmptyResult(lines: string[]): boolean {
  return !lines.length || (lines.length === 1 && !lines[0].trim());
}

function processGrepLines(
  lines: string[],
  highlighter: ((text: string) => string) | null,
  theme: Theme,
): string[] {
  const out: string[] = [];
  let currentFile = "";
  let count = 0;

  for (const line of lines) {
    if (count >= MAX_PREVIEW_LINES) {
      out.push(theme.fg("dim", "  … more matches"));
      break;
    }

    const {
      output,
      newFile,
      count: lineCount,
    } = processGrepLine(line, currentFile, highlighter, theme);
    out.push(...output);
    currentFile = newFile;
    count += lineCount;
  }

  return out;
}
