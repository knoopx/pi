import type { Theme } from "@mariozechner/pi-coding-agent";
import { dirname, basename } from "node:path";
import { hlBlock, MAX_PREVIEW_LINES } from "./shiki";
import { fileIconGlyph, dirIconGlyph } from "./icons";
import { termW, strip } from "./utils";
import { lang } from "./language";

function truncateAnsiLine(
  code: string,
  maxVisible: number,
  theme: Theme,
): string {
  const plain = strip(code);
  if (plain.length <= maxVisible) return code;

  let vis = 0;
  let j = 0;
  while (j < code.length && vis < maxVisible - 1) {
    if (code[j] === "\x1b") {
      const e = code.indexOf("m", j);
      if (e !== -1) {
        j = e + 1;
        continue;
      }
    }
    vis++;
    j++;
  }
  return `${code.slice(0, j)}${theme.fg("muted", "›")}`;
}

function formatLineWithNumber(
  ln: number,
  code: string,
  nw: number,
  tw: number,
  theme: Theme,
): string {
  const display = truncateAnsiLine(code, tw - nw - 4, theme);
  const lnStr = " ".repeat(Math.max(0, nw - String(ln).length)) + ln;
  return `${theme.fg("muted", lnStr)} ${theme.fg("border", "│")} ${display}`;
}

export async function renderFileContent(
  content: string,
  filePath: string,
  offset: number,
  maxLines: number,
  theme: Theme,
): Promise<string> {
  const lines = content.split("\n");
  const total = lines.length;
  const show = lines.slice(0, maxLines);
  const lg = lang(filePath);
  const mutedColor = theme.getFgAnsi("muted");
  const hl = await hlBlock(show.join("\n"), lg, mutedColor);

  const tw = termW();
  const startLine = offset;
  const endLine = startLine + show.length - 1;
  const nw = Math.max(3, String(endLine).length);

  const out: string[] = [];
  out.push(theme.fg("border", "─".repeat(tw)));

  for (let i = 0; i < hl.length; i++) {
    const ln = startLine + i;
    const code = hl[i] ?? show[i] ?? "";
    out.push(formatLineWithNumber(ln, code, nw, tw, theme));
  }

  out.push(theme.fg("border", "─".repeat(tw)));
  if (total > maxLines) out.push(
    theme.fg("dim", `  … ${total - maxLines} more lines (${total} total)`),
  );
  return out.join("\n");
}

export function renderTree(text: string, theme: Theme): string {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return theme.fg("dim", "(empty directory)");

  const out: string[] = [];
  const total = lines.length;
  const show = lines.slice(0, MAX_PREVIEW_LINES);

  for (let i = 0; i < show.length; i++) {
    const entry = show[i].trim();
    const isLast = i === show.length - 1 && total <= MAX_PREVIEW_LINES;
    const prefix = isLast ? "└── " : "├── ";
    const connector = theme.fg("border", prefix);

    const isDir = entry.endsWith("/");
    const name = isDir ? entry.slice(0, -1) : entry;
    const icon = isDir ? dirIconGlyph() : fileIconGlyph(name);
    const fg = isDir ? theme.fg("accent", icon + name) : icon + name;

    out.push(`${connector}${fg}`);
  }

  if (total > MAX_PREVIEW_LINES) out.push(
    `${theme.fg("border", "└── ")}${theme.fg("dim", `… ${total - MAX_PREVIEW_LINES} more entries`)}`,
  );

  return out.join("\n");
}

function groupFilesByDirectory(lines: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const trimmed = line.trim();
    const dir = dirname(trimmed) || ".";
    const file = basename(trimmed);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(file);
  }
  return groups;
}

function renderDirectoryFiles(
  dir: string,
  files: string[],
  theme: Theme,
  maxCount: number,
  totalCount: number,
  totalLines: number,
): { lines: string[]; count: number } {
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
    const { lines: dirLines } = renderDirectoryFiles(
      dir,
      files,
      theme,
      MAX_PREVIEW_LINES,
      count,
      lines.length,
    );
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
  if (parsed) {
    const { file, lineNo, content } = parsed;
    const out: string[] = [];
    if (file !== currentFile) {
      if (currentFile) out.push("");
      const icon = fileIconGlyph(file);
      out.push(`${icon}${theme.bold(theme.fg("accent", file))}`);
    }
    out.push(renderGrepMatch(lineNo, content, highlighter, theme));
    return { output: out, newFile: file, count: 1 };
  } else if (line.trim() === "--")
    return {
      output: [theme.fg("dim", "  ···")],
      newFile: currentFile,
      count: 0,
    };
  else if (line.trim())
    return { output: [line], newFile: currentFile, count: 1 };
  return { output: [], newFile: currentFile, count: 0 };
}

export async function renderGrepResults(
  text: string,
  pattern: string,
  theme: Theme,
): Promise<string> {
  const lines = text.split("\n");
  if (!lines.length || (lines.length === 1 && !lines[0].trim()))
    return theme.fg("dim", "(no matches)");

  const out: string[] = [];
  let currentFile = "";
  let count = 0;
  const highlighter = createPatternHighlighter(pattern, theme);

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

  return out.join("\n");
}
