import type { Cursor } from "./types";

export function getSelectionRange(
  anchor: Cursor | null,
  cursor: Cursor,
): { start: Cursor; end: Cursor } | null {
  if (!anchor) return null;
  if (cursorsEqual(anchor, cursor)) return null;

  if (compareCursor(anchor, cursor) <= 0) {
    return { start: { ...anchor }, end: { ...cursor } };
  }
  return { start: { ...cursor }, end: { ...anchor } };
}

function cursorsEqual(a: Cursor, b: Cursor): boolean {
  return a.line === b.line && a.col === b.col;
}

function compareCursor(a: Cursor, b: Cursor): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.col - b.col;
}
