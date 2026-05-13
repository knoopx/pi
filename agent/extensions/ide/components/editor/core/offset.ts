import type { Cursor } from "../types";

export function offsetFromCursor(lines: string[], cursor: Cursor): number {
  let offset = 0;
  for (let i = 0; i < cursor.line; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  offset += cursor.col;
  return offset;
}

export function cursorFromOffset(lines: string[], offset: number): Cursor {
  const found = findLineForOffset(lines, Math.max(0, offset));
  if (found) return found;
  const lastLine = Math.max(0, lines.length - 1);
  return { line: lastLine, col: lines[lastLine]?.length ?? 0 };
}

export function findLineForOffset(
  lines: string[],
  offset: number,
): Cursor | null {
  let remaining = offset;
  for (let i = 0; i < lines.length; i++) {
    const length = lines[i]?.length ?? 0;
    if (remaining <= length) return { line: i, col: remaining };
    remaining -= length + 1;
  }
  return null;
}
