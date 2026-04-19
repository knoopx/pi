import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  CURSOR_MARKER,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui";

import type { Cursor } from "./types";

export interface RenderOptions {
  lines: string[];
  width: number;
  height: number;
  cursor: Cursor;
  topLine: number;
  showCursor: boolean;
  selection: { start: Cursor; end: Cursor } | null;
}

interface RenderResult {
  lines: string[];
}

function formatLineNumber(num: number, width: number): string {
  return num.toString().padStart(width - 1, " ") + " ";
}

function getSelectionCols(
  selection: { start: Cursor; end: Cursor },
  lineIndex: number,
  lineLen: number,
): { start: number; end: number } | null {
  const sLine = Math.min(selection.start.line, selection.end.line);
  const eLine = Math.max(selection.start.line, selection.end.line);
  if (lineIndex < sLine || lineIndex > eLine) return null;

  let startCol = 0;
  let endCol = lineLen;

  if (lineIndex === sLine) {
    startCol = selection.start.col;
  }
  if (lineIndex === eLine) {
    endCol = selection.end.col;
  }

  // Normalize: handle case where end.col === 0 on next line means select to end of prev line
  if (
    lineIndex === sLine &&
    selection.end.line > selection.start.line &&
    selection.end.col === 0
  ) {
    endCol = lineLen;
  }

  return startCol < endCol ? { start: startCol, end: endCol } : null;
}

export function renderEditorView(
  theme: Theme,
  opts: RenderOptions,
): RenderResult {
  const { lines, width, height, cursor, topLine, showCursor, selection } = opts;
  const lineNumWidth = Math.max(4, (lines.length + 1).toString().length) + 1;
  const result: string[] = [];

  for (let i = topLine; i < lines.length; i++) {
    if (result.length >= height) break;

    const lineIndex = i;
    const lineContent = lines[i] ?? "";
    const isCursorLine = lineIndex === cursor.line;

    // Line number prefix
    const lnText = formatLineNumber(lineIndex + 1, lineNumWidth);
    const prefix = theme.fg("dim", lnText);

    let content = lineContent;

    // Apply selection highlighting
    const selCols = selection
      ? getSelectionCols(selection, lineIndex, visibleWidth(lineContent))
      : null;
    if (selCols) {
      const before = lineContent.slice(0, selCols.start);
      const selected = lineContent.slice(selCols.start, selCols.end);
      const after = lineContent.slice(selCols.end);
      content = before + theme.bg("selectedBg", selected) + after;
    }

    let output = prefix + content;

    // Cursor marker
    if (isCursorLine && showCursor) {
      const cursorCol = visibleWidth(lineContent.slice(0, cursor.col));
      const insertPos = findInsertPosition(output, cursorCol + lineNumWidth);
      output =
        output.slice(0, insertPos) + CURSOR_MARKER + output.slice(insertPos);
    }

    // Truncate to width
    output = truncateToWidth(output, width, "", true);
    result.push(output);
  }

  // Pad with empty lines if content is shorter than viewport
  while (result.length < height) {
    result.push("");
  }

  return { lines: result };
}

function findInsertPosition(line: string, column: number): number {
  let currentWidth = 0;
  let i = 0;

  while (i < line.length && currentWidth < column) {
    // Skip ANSI escape sequences
    if (line[i] === "\x1b") {
      const match = line.slice(i).match(/\x1b\[[0-9;]*[a-zA-Z]/);
      if (match) {
        i += match[0].length;
        continue;
      }
    }

    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    const segment =
      Array.from(segmenter.segment(line.slice(i)))[0]?.segment ?? line[i];
    const charWidth = visibleWidth(segment);

    if (currentWidth + charWidth > column) {
      return i;
    }

    currentWidth += charWidth;
    i += segment.length;
  }

  return i;
}
