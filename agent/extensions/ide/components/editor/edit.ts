import type { Cursor } from "./types";
import {
  getLeadingWhitespace,
  findWordBoundaryBackward,
  findWordBoundaryForward,
} from "./helpers";

type DeleteBody = (lines: string[], cursor: Cursor) => void;

type DeleteResult = {
  lines: string[];
  cursor: Cursor;
  selectionAnchor: Cursor | null;
};

type DelSelFn = (
  lines: string[],
  c: Cursor,
  anchor: Cursor | null,
  range: { start: Cursor; end: Cursor } | null,
) => DeleteResult;

function withSelection<T>(
  hasSelection: boolean,
  delSelFn: DelSelFn,
  selectionAnchor: Cursor | null,
  selectionRange: { start: Cursor; end: Cursor } | null,
  noSelection: () => T,
): T {
  if (hasSelection)
    return delSelFn(
      [],
      { line: 0, col: 0 },
      selectionAnchor,
      selectionRange,
    ) as unknown as T;
  return noSelection();
}

function insertAtCursor(
  lines: string[],
  cursor: Cursor,
  text: string,
): { lines: string[]; cursor: Cursor } {
  const line = lines[cursor.line] ?? "";
  const before = line.slice(0, cursor.col);
  const after = line.slice(cursor.col);
  lines[cursor.line] = before + text + after;
  cursor.col += text.length;
  return { lines, cursor };
}

export function insertPair(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  selectionRange: { start: Cursor; end: Cursor } | null,
  selectedText: string,
  offsetFromCursor: (c: Cursor) => number,
  cursorFromOffset: (o: number) => Cursor,
  open: string,
  close: string,
): { lines: string[]; cursor: Cursor; selectionAnchor: Cursor | null } {
  if (selectionRange) {
    const startOffset = offsetFromCursor(selectionRange.start);
    const newContent = `${open}${selectedText}${close}`;
    const nextContent = replaceInRange(
      lines,
      selectionRange.start,
      selectionRange.end,
      newContent,
    );
    const newStart = cursorFromOffset(startOffset + 1);
    const newEnd = cursorFromOffset(startOffset + 1 + selectedText.length);
    return { lines: nextContent, cursor: newEnd, selectionAnchor: newStart };
  }
  const insertOffset = offsetFromCursor(cursor);
  const result = insertAtCursor(lines, cursor, `${open}${close}`);
  const newCursor = cursorFromOffset(insertOffset + 1);
  return { lines: result.lines, cursor: newCursor, selectionAnchor: null };
}

function replaceInRange(
  lines: string[],
  start: Cursor,
  end: Cursor,
  text: string,
): string[] {
  const content = lines.join("\n");
  const startOffset = offsetFromLines(content, start);
  const endOffset = offsetFromLines(content, end);
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const nextContent =
    content.slice(0, startOffset) + normalized + content.slice(endOffset);
  return nextContent.split("\n");
}

function offsetFromLines(content: string, cursor: Cursor): number {
  let offset = 0;
  for (let i = 0; i < cursor.line; i++) {
    offset += (content.split("\n")[i]?.length ?? 0) + 1;
  }
  offset += cursor.col;
  return offset;
}

export function insertChar(
  lines: string[],
  cursor: Cursor,
  char: string,
): { lines: string[]; cursor: Cursor } {
  return insertAtCursor(lines, cursor, char);
}

export function insertText(
  lines: string[],
  cursor: Cursor,
  text: string,
  _hasSelection: boolean,
  _replaceSelFn: (
    lines: string[],
    c: Cursor,
    t: string,
  ) => { lines: string[]; cursor: Cursor },
): { lines: string[]; cursor: Cursor } {
  if (!text) return { lines, cursor };
  return insertAtCursor(lines, cursor, text);
}

function makeDelete(
  delSelFn: DelSelFn,
  body: DeleteBody,
): (
  lines: string[],
  cursor: Cursor,
  hasSelection: boolean,
  selectionRange: { start: Cursor; end: Cursor } | null,
  selectionAnchor: Cursor | null,
) => DeleteResult {
  return (lines, cursor, hasSelection, selectionRange, selectionAnchor) =>
    withSelection(
      hasSelection,
      delSelFn,
      selectionAnchor,
      selectionRange,
      () => {
        body(lines, cursor);
        return { lines, cursor, selectionAnchor };
      },
    );
}

type DeleteFn = (
  lines: string[],
  cursor: Cursor,
  hasSelection: boolean,
  delSelFn: DelSelFn,
  selectionRange: { start: Cursor; end: Cursor } | null,
  selectionAnchor: Cursor | null,
) => DeleteResult;

function createDeleteFn(body: DeleteBody): DeleteFn {
  return (
    lines,
    cursor,
    hasSelection,
    delSelFn,
    selectionRange,
    selectionAnchor,
  ) =>
    makeDelete(delSelFn, body)(
      lines,
      cursor,
      hasSelection,
      selectionRange,
      selectionAnchor,
    );
}

export const deleteCharBackward = createDeleteFn(deleteCharBackwardBody);
export const deleteCharForward = createDeleteFn(deleteCharForwardBody);

function joinLinesBackward(lines: string[], cursor: Cursor): void {
  const prevLine = lines[cursor.line - 1] ?? "";
  const currentLine = lines[cursor.line] ?? "";
  lines.splice(cursor.line - 1, 2, prevLine + currentLine);
  cursor.col = prevLine.length;
  cursor.line--;
}

function joinLinesForward(lines: string[], cursor: Cursor): void {
  const currentLine = lines[cursor.line] ?? "";
  const nextLine = lines[cursor.line + 1] ?? "";
  lines.splice(cursor.line, 2, currentLine + nextLine);
}

function deleteCharForwardBody(lines: string[], cursor: Cursor): void {
  const line = lines[cursor.line] ?? "";
  if (cursor.col < line.length) {
    lines[cursor.line] = line.slice(0, cursor.col) + line.slice(cursor.col + 1);
  } else {
    joinLinesForward(lines, cursor);
  }
}

function deleteCharBackwardBody(lines: string[], cursor: Cursor): void {
  if (cursor.col > 0) {
    const line = lines[cursor.line] ?? "";
    lines[cursor.line] = line.slice(0, cursor.col - 1) + line.slice(cursor.col);
    cursor.col--;
  } else {
    joinLinesBackward(lines, cursor);
  }
}

function deleteWordForwardBody(lines: string[], cursor: Cursor): void {
  const line = lines[cursor.line] ?? "";
  const col = cursor.col;
  const lineLen = line.length;

  if (col === lineLen && cursor.line === lines.length - 1) return;
  if (cursor.col !== lineLen || cursor.line >= lines.length - 1) {
    const deleteEnd = findWordBoundaryForward(line, col, lineLen);
    if (deleteEnd > col) {
      lines[cursor.line] = line.slice(0, col) + line.slice(deleteEnd);
    }
  } else {
    const nextLine = lines[cursor.line + 1] ?? "";
    lines.splice(cursor.line, 2, line + nextLine);
  }
}

function deleteWordBackwardBody(lines: string[], cursor: Cursor): void {
  const line = lines[cursor.line] ?? "";
  const col = cursor.col;

  if (col === 0 && cursor.line === 0) return;
  if (cursor.col !== 0 || cursor.line === 0) {
    const deleteEnd = findWordBoundaryBackward(line, col);
    if (deleteEnd < col) {
      lines[cursor.line] = line.slice(0, deleteEnd) + line.slice(col);
      cursor.col = deleteEnd;
    }
  } else if (cursor.line > 0) {
    const prevLine = lines[cursor.line - 1] ?? "";
    lines.splice(cursor.line - 1, 2, prevLine + line);
    cursor.col = prevLine.length;
    cursor.line--;
  }
}

export function insertNewline(
  lines: string[],
  cursor: Cursor,
  hasSelection: boolean,
  replaceSelFn: (
    lines: string[],
    c: Cursor,
    t: string,
  ) => { lines: string[]; cursor: Cursor },
): { lines: string[]; cursor: Cursor } {
  if (hasSelection) {
    return replaceSelFn(lines, cursor, "\n");
  }
  const line = lines[cursor.line] ?? "";
  const beforeCursor = line.slice(0, cursor.col);
  const afterCursor = line.slice(cursor.col);
  const indent = getLeadingWhitespace(beforeCursor);

  lines[cursor.line] = beforeCursor;
  lines.splice(cursor.line + 1, 0, indent + afterCursor);
  cursor.line++;
  cursor.col = indent.length;
  return { lines, cursor };
}

export const deleteWordBackward = createDeleteFn(deleteWordBackwardBody);
export const deleteWordForward = createDeleteFn(deleteWordForwardBody);
export const deleteLine = createDeleteFn((lines, cursor) => {
  if (lines.length === 1) {
    lines[0] = "";
    cursor.col = 0;
    return;
  }
  lines.splice(cursor.line, 1);
  if (cursor.line >= lines.length) {
    cursor.line = lines.length - 1;
    cursor.col = (lines[cursor.line] ?? "").length;
  } else {
    cursor.col = 0;
  }
});

export function toggleComment(
  lines: string[],
  cursor: Cursor,
  line: string,
): { lines: string[]; cursor: Cursor } {
  const trimmed = line.trim();
  if (trimmed.startsWith("//")) {
    const uncommented = line.replace(/^(\s*)\/\/\s?/, "$1");
    lines[cursor.line] = uncommented;
    if (cursor.col >= uncommented.length) cursor.col = uncommented.length;
  } else {
    const indent = getLeadingWhitespace(line);
    const commented = indent + "// " + line.slice(indent.length);
    lines[cursor.line] = commented;
    cursor.col += 3;
  }
  return { lines, cursor };
}

export function replaceSelection(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  selectionRange: { start: Cursor; end: Cursor } | null,
  text: string,
): { lines: string[]; cursor: Cursor; selectionAnchor: Cursor | null } {
  if (!selectionRange) {
    const result = insertText(lines, cursor, text, false, () => ({
      lines: lines,
      cursor: cursor,
      selectionAnchor: null,
    }));
    return {
      lines: result.lines,
      cursor: result.cursor,
      selectionAnchor: null,
    };
  }
  const result = replaceInRange(
    lines,
    selectionRange.start,
    selectionRange.end,
    text,
  );
  const newCursor = cursorFromOffsetForLines(
    result,
    selectionRange.start,
    text.length,
  );
  return { lines: result, cursor: newCursor, selectionAnchor: null };
}

function cursorFromOffsetForLines(
  lines: string[],
  start: Cursor,
  offset: number,
): Cursor {
  let remaining = offset;
  for (let i = 0; i < lines.length; i++) {
    const length = lines[i]?.length ?? 0;
    if (remaining <= length) return { line: i, col: remaining };
    remaining -= length + 1;
  }
  const lastLine = Math.max(0, lines.length - 1);
  return { line: lastLine, col: lines[lastLine]?.length ?? 0 };
}
