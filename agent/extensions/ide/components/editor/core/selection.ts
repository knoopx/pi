import * as selection from "../selection-range";
import type { Cursor } from "../types";
import type { EditorCoreState } from "./state";
import { adjustScroll } from "./state";
import { offsetFromCursor } from "./offset";

export function selectAll(state: EditorCoreState): void {
  state.selectionAnchor = { line: 0, col: 0 };
  const lastLine = Math.max(0, state.lines.length - 1);
  state.cursor = { line: lastLine, col: state.lines[lastLine]?.length ?? 0 };
  adjustScroll(state);
}

export function clearSelection(state: EditorCoreState): void {
  state.selectionAnchor = null;
}

export function setSelection(
  state: EditorCoreState,
  start: Cursor,
  end: Cursor,
): void {
  state.selectionAnchor = { ...start };
  state.cursor = { ...end };
  adjustScroll(state);
}

export function getSelection(
  state: EditorCoreState,
): { start: Cursor; end: Cursor } | null {
  return selection.getSelectionRange(state.selectionAnchor, state.cursor);
}

export function getSelectedText(state: EditorCoreState): string {
  const range = selection.getSelectionRange(
    state.selectionAnchor,
    state.cursor,
  );
  if (!range) return "";
  const content = state.lines.join("\n");
  const startOffset = offsetFromCursor(state.lines, range.start);
  const endOffset = offsetFromCursor(state.lines, range.end);
  return content.slice(startOffset, endOffset);
}
