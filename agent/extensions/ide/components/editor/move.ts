import type { Cursor } from "./types";
import { clampCol, moveWordLeftOnLine, moveWordRightOnLine } from "./helpers";

export function moveCursor(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  viewHeight: number,
  topLine: number,
  direction: "up" | "down" | "left" | "right",
  select = false,
): { cursor: Cursor; selectionAnchor: Cursor | null; topLine: number } {
  const newAnchor = beginSelection(selectionAnchor, cursor, select);
  executeMove(lines, cursor, direction);
  const finalAnchor = finalizeSelection(newAnchor, cursor);
  const newTopLine = adjustScroll(cursor, topLine, viewHeight);
  return { cursor, selectionAnchor: finalAnchor, topLine: newTopLine };
}

export function moveToLineStart(
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  line: string,
  select = false,
): { cursor: Cursor; selectionAnchor: Cursor | null } {
  const newAnchor = beginSelection(selectionAnchor, cursor, select);
  const firstNonSpace = line.search(/\S/);
  if (firstNonSpace === -1 || cursor.col === firstNonSpace) {
    cursor.col = 0;
  } else {
    cursor.col = firstNonSpace;
  }
  const finalAnchor = finalizeSelection(newAnchor, cursor);
  return { cursor, selectionAnchor: finalAnchor };
}

export function moveToLineEnd(
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  line: string,
  select = false,
): { cursor: Cursor; selectionAnchor: Cursor | null } {
  const newAnchor = beginSelection(selectionAnchor, cursor, select);
  cursor.col = line.length;
  const finalAnchor = finalizeSelection(newAnchor, cursor);
  return { cursor, selectionAnchor: finalAnchor };
}

export function setCursor(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  line: number,
  col = 0,
  clearSelection = true,
): { cursor: Cursor; selectionAnchor: Cursor | null } {
  const clampedLine = Math.max(0, Math.min(line, lines.length - 1));
  cursor.line = clampedLine;
  cursor.col = Math.max(0, Math.min(col, lines[cursor.line]?.length ?? 0));
  if (clearSelection) selectionAnchor = null;
  return { cursor, selectionAnchor };
}

export function movePageUp(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  viewHeight: number,
  topLine: number,
  select = false,
): { cursor: Cursor; selectionAnchor: Cursor | null; topLine: number } {
  return movePage(
    lines,
    cursor,
    selectionAnchor,
    viewHeight,
    topLine,
    select,
    -1,
  );
}

export function movePageDown(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  viewHeight: number,
  topLine: number,
  select = false,
): { cursor: Cursor; selectionAnchor: Cursor | null; topLine: number } {
  return movePage(
    lines,
    cursor,
    selectionAnchor,
    viewHeight,
    topLine,
    select,
    1,
  );
}

function movePage(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  viewHeight: number,
  topLine: number,
  select: boolean,
  direction: -1 | 1,
): { cursor: Cursor; selectionAnchor: Cursor | null; topLine: number } {
  const newAnchor = beginSelection(selectionAnchor, cursor, select);
  const pageMoveCount = Math.max(1, viewHeight - 1);
  const boundary = direction === -1 ? 0 : lines.length - 1;
  for (let i = 0; i < pageMoveCount; i++) {
    if (
      (direction === -1 && cursor.line === 0) ||
      (direction === 1 && cursor.line >= boundary)
    )
      break;
    cursor.line += direction;
  }
  clampCol(lines, cursor);
  const finalAnchor = finalizeSelection(newAnchor, cursor);
  const newTopLine = adjustScroll(cursor, topLine, viewHeight);
  return { cursor, selectionAnchor: finalAnchor, topLine: newTopLine };
}

export function moveWordLeft(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  select = false,
): { cursor: Cursor; selectionAnchor: Cursor | null } {
  const newAnchor = beginSelection(selectionAnchor, cursor, select);
  if (cursor.col === 0 && cursor.line > 0) {
    cursor.line--;
    cursor.col = lines[cursor.line]?.length ?? 0;
  } else {
    moveWordLeftOnLine(lines, cursor);
  }
  const finalAnchor = finalizeSelection(newAnchor, cursor);
  return { cursor, selectionAnchor: finalAnchor };
}

export function moveWordRight(
  lines: string[],
  cursor: Cursor,
  selectionAnchor: Cursor | null,
  select = false,
): { cursor: Cursor; selectionAnchor: Cursor | null } {
  const newAnchor = beginSelection(selectionAnchor, cursor, select);
  const line = lines[cursor.line] ?? "";
  if (cursor.col >= line.length && cursor.line < lines.length - 1) {
    cursor.line++;
    cursor.col = 0;
  } else {
    moveWordRightOnLine(lines, cursor);
  }
  const finalAnchor = finalizeSelection(newAnchor, cursor);
  return { cursor, selectionAnchor: finalAnchor };
}

function beginSelection(
  anchor: Cursor | null,
  cursor: Cursor,
  select: boolean,
): Cursor | null {
  if (select) {
    if (!anchor) return { ...cursor };
  } else {
    return null;
  }
  return anchor;
}

function finalizeSelection(
  anchor: Cursor | null,
  cursor: Cursor,
): Cursor | null {
  if (!anchor) return null;
  if (cursorsEqual(anchor, cursor)) return null;
  return anchor;
}

function executeMove(
  lines: string[],
  cursor: Cursor,
  direction: "up" | "down" | "left" | "right",
): void {
  switch (direction) {
    case "up":
      moveUp(lines, cursor);
      break;
    case "down":
      moveDown(lines, cursor);
      break;
    case "left":
      moveLeft(lines, cursor);
      break;
    case "right":
      moveRight(lines, cursor);
      break;
  }
}

function moveUp(lines: string[], cursor: Cursor): void {
  if (cursor.line > 0) {
    cursor.line--;
    clampCol(lines, cursor);
  }
}

function moveDown(lines: string[], cursor: Cursor): void {
  if (cursor.line < lines.length - 1) {
    cursor.line++;
    clampCol(lines, cursor);
  }
}

function moveLeft(lines: string[], cursor: Cursor): void {
  if (cursor.col > 0) {
    cursor.col--;
  } else if (cursor.line > 0) {
    cursor.line--;
    cursor.col = lines[cursor.line]?.length ?? 0;
  }
}

function moveRight(lines: string[], cursor: Cursor): void {
  const lineLen = lines[cursor.line]?.length ?? 0;
  if (cursor.col < lineLen) {
    cursor.col++;
  } else if (cursor.line < lines.length - 1) {
    cursor.line++;
    cursor.col = 0;
  }
}

function adjustScroll(
  cursor: Cursor,
  topLine: number,
  viewHeight: number,
): number {
  let newTopLine = topLine;
  if (cursor.line < newTopLine) {
    newTopLine = cursor.line;
  }
  if (cursor.line >= newTopLine + viewHeight) {
    newTopLine = cursor.line - viewHeight + 1;
  }
  return newTopLine;
}

function cursorsEqual(a: Cursor, b: Cursor): boolean {
  return a.line === b.line && a.col === b.col;
}
