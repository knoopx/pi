export interface Cursor {
  line: number;
  col: number;
}

export interface EditorState {
  lines: string[];
  cursor: Cursor;
  topLine: number;
  selectionAnchor: Cursor | null;
}
