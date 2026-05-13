import type { Cursor, EditorState } from "../types";

export interface EditorCoreState {
  lines: string[];
  cursor: Cursor;
  selectionAnchor: Cursor | null;
  topLine: number;
  viewHeight: number;
}

export function createEditorState(content: string = ""): EditorCoreState {
  const lines = content.split("\n");
  return {
    lines: lines.length > 0 ? lines : [""],
    cursor: { line: 0, col: 0 },
    selectionAnchor: null,
    topLine: 0,
    viewHeight: 20,
  };
}

export function setContent(state: EditorCoreState, content: string): void {
  const lines = content.split("\n");
  state.lines = lines.length > 0 ? lines : [""];
  state.cursor = { line: 0, col: 0 };
  state.selectionAnchor = null;
  state.topLine = 0;
}

export function captureState(state: EditorCoreState): EditorState {
  return {
    lines: [...state.lines],
    cursor: { ...state.cursor },
    topLine: state.topLine,
    selectionAnchor: state.selectionAnchor
      ? { ...state.selectionAnchor }
      : null,
  };
}

export function restoreState(state: EditorCoreState, saved: EditorState): void {
  state.lines = saved.lines;
  state.cursor = saved.cursor;
  state.topLine = saved.topLine;
  state.selectionAnchor = saved.selectionAnchor
    ? { ...saved.selectionAnchor }
    : null;
}

export function adjustScroll(state: EditorCoreState): void {
  if (state.cursor.line < state.topLine) {
    state.topLine = state.cursor.line;
  }
  if (state.cursor.line >= state.topLine + state.viewHeight) {
    state.topLine = state.cursor.line - state.viewHeight + 1;
  }
}
