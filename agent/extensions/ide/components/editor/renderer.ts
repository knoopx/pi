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

  // When selection spans multiple lines and ends at col 0, the previous line is fully selected
  if (
    lineIndex === sLine &&
    selection.end.line > selection.start.line &&
    selection.end.col === 0
  ) {
    endCol = lineLen;
  }

  return startCol < endCol ? { start: startCol, end: endCol } : null;
}

function applySelectionHighlighting(
  lineContent: string,
  selCols: { start: number; end: number } | null,
  theme: Theme,
): string {
  if (!selCols) return lineContent;

  const before = lineContent.slice(0, selCols.start);
  const selected = lineContent.slice(selCols.start, selCols.end);
  const after = lineContent.slice(selCols.end);
  return before + theme.bg("selectedBg", selected) + after;
}

function skipLeadingAnsiEscapes(text: string): {
  leading: string;
  rest: string;
} {
  let ansiLen = 0;
  while (ansiLen < text.length && text[ansiLen] === "\x1b") {
    const match = text.slice(ansiLen).match(/^\x1b\[[0-9;]*[a-zA-Z]/);
    if (match) {
      ansiLen += match[0].length;
    } else {
      break;
    }
  }
  return { leading: text.slice(0, ansiLen), rest: text.slice(ansiLen) };
}

interface GraphemeInfo {
  index: number;
  length: number;
}

function getFirstGrapheme(text: string): GraphemeInfo | null {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const first = Array.from(segmenter.segment(text))[0];
  if (!first) return null;
  return { index: first.index, length: first.segment.length };
}

function insertCursorMarker(
  output: string,
  cursorCol: number,
  lineNumWidth: number,
): string {
  const insertPos = findInsertPosition(output, cursorCol + lineNumWidth);
  const before = output.slice(0, insertPos);
  const after = output.slice(insertPos);

  if (after.length === 0) {
    return before + CURSOR_MARKER + "\x1b[7m \x1b[0m";
  }

  const { leading: leadingAnsi, rest: remaining } =
    skipLeadingAnsiEscapes(after);

  if (remaining.length > 0) {
    const firstGrapheme = getFirstGrapheme(remaining);
    if (firstGrapheme && firstGrapheme.length > 0) {
      const cursorChar = remaining.slice(
        firstGrapheme.index,
        firstGrapheme.index + firstGrapheme.length,
      );
      const rest = remaining.slice(firstGrapheme.index + firstGrapheme.length);
      return (
        before +
        CURSOR_MARKER +
        leadingAnsi +
        `\x1b[7m${cursorChar}\x1b[0m` +
        rest
      );
    }
  }

  // No valid grapheme found — place cursor at end with space
  return before + CURSOR_MARKER + after + "\x1b[7m \x1b[0m";
}

interface SingleLineRenderOptions {
  lineIndex: number;
  lineContent: string;
  theme: Theme;
  width: number;
  lineNumWidth: number;
  cursor: Cursor;
  showCursor: boolean;
  selection: { start: Cursor; end: Cursor } | null;
}

function renderSingleLine(opts: SingleLineRenderOptions): string {
  const {
    lineIndex,
    lineContent,
    theme,
    width,
    lineNumWidth,
    cursor,
    showCursor,
    selection,
  } = opts;

  const lnText = formatLineNumber(lineIndex + 1, lineNumWidth);
  const prefix = theme.fg("dim", lnText);

  const selCols = selection
    ? getSelectionCols(selection, lineIndex, visibleWidth(lineContent))
    : null;
  const content = applySelectionHighlighting(lineContent, selCols, theme);

  let output = prefix + content;

  if (lineIndex === cursor.line && showCursor) {
    const cursorCol = visibleWidth(lineContent.slice(0, cursor.col));
    output = insertCursorMarker(output, cursorCol, lineNumWidth);
  }

  return truncateToWidth(output, width, "", true);
}

export function renderEditorView(
  theme: Theme,
  opts: RenderOptions,
): RenderResult {
  const { lines, width, height, cursor, topLine, showCursor, selection } = opts;
  const lineNumWidth = Math.max(4, (lines.length + 1).toString().length) + 1;
  const result: string[] = [];

  for (let i = topLine; i < lines.length && result.length < height; i++) {
    result.push(
      renderSingleLine({
        lineIndex: i,
        lineContent: lines[i] ?? "",
        theme,
        width,
        lineNumWidth,
        cursor,
        showCursor,
        selection,
      }),
    );
  }

  while (result.length < height) {
    result.push("");
  }

  return { lines: result };
}

function findInsertPosition(line: string, column: number): number {
  let currentWidth = 0;
  let i = 0;

  while (i < line.length && currentWidth < column) {
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
