import { History } from "../history";
import type { Cursor, EditorState } from "../types";
import type { EditorCoreState } from "./state";
import {
  createEditorState,
  setContent,
  captureState,
  restoreState,
} from "./state";
import * as move from "../move";
import * as edit from "../edit";
import * as selection from "../selection-range";
import {
  selectAll,
  clearSelection,
  setSelection as setSelectionFn,
  getSelection,
  getSelectedText,
} from "./selection";
import { offsetFromCursor, cursorFromOffset } from "./offset";

export class Editor {
  private state: EditorCoreState;
  private history = new History();

  constructor(content: string = "") {
    this.state = createEditorState(content);
  }

  setViewHeight(height: number): void {
    this.state.viewHeight = Math.max(1, height);
  }

  getLines(): readonly string[] {
    return this.state.lines;
  }

  getCursor(): Cursor {
    return { ...this.state.cursor };
  }

  getSelection(): { start: Cursor; end: Cursor } | null {
    return getSelection(this.state);
  }

  hasSelection(): boolean {
    return (
      selection.getSelectionRange(
        this.state.selectionAnchor,
        this.state.cursor,
      ) !== null
    );
  }

  clearSelection(): void {
    clearSelection(this.state);
  }

  selectAll(): void {
    selectAll(this.state);
  }

  getSelectedText(): string {
    return getSelectedText(this.state);
  }

  getTopLine(): number {
    return this.state.topLine;
  }

  getContent(): string {
    return this.state.lines.join("\n");
  }

  setContent(content: string): void {
    setContent(this.state, content);
    this.history.clear();
  }

  setSelection(start: Cursor, end: Cursor): void {
    setSelectionFn(this.state, start, end);
  }

  insertPair(open: string, close: string): void {
    const selectionRange = selection.getSelectionRange(
      this.state.selectionAnchor,
      this.state.cursor,
    );
    const result = edit.insertPair(
      this.state.lines,
      this.state.cursor,
      this.state.selectionAnchor,
      selectionRange,
      this.getSelectedText(),
      (c: Cursor) => offsetFromCursor(this.state.lines, c),
      (o: number) => cursorFromOffset(this.state.lines, o),
      open,
      close,
    );
    this.state.lines = result.lines;
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
  }

  insertChar(char: string): void {
    this.saveState();
    const result = edit.insertChar(this.state.lines, this.state.cursor, char);
    this.state.lines = result.lines;
    this.state.cursor = result.cursor;
  }

  insertText(text: string): void {
    if (!text) return;
    if (this.hasSelection()) {
      this.replaceSelection(text);
      return;
    }
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parts = normalized.split("\n");
    const line = this.state.lines[this.state.cursor.line] ?? "";
    const before = line.slice(0, this.state.cursor.col);
    const after = line.slice(this.state.cursor.col);

    if (parts.length === 1) {
      this.saveState();
      const inserted = parts[0] ?? "";
      this.state.lines[this.state.cursor.line] = before + inserted + after;
      this.state.cursor.col += inserted.length;
    } else {
      this.saveState();
      const first = parts[0] ?? "";
      this.state.lines[this.state.cursor.line] = before + first;
      const middle = parts.slice(1, -1);
      const last = parts[parts.length - 1] ?? "";
      const insertLines = [...middle, last + after];
      this.state.lines.splice(this.state.cursor.line + 1, 0, ...insertLines);
      this.state.cursor.line += insertLines.length;
      this.state.cursor.col = last.length;
    }
  }

  deleteCharBackward(): void {
    this.applyDeleteEdit(edit.deleteCharBackward);
  }

  deleteCharForward(): void {
    this.applyDeleteEdit(edit.deleteCharForward);
  }

  insertNewline(): void {
    this.saveState();
    const result = edit.insertNewline(
      this.state.lines,
      this.state.cursor,
      this.hasSelection(),
      (lines, cursor, text) => {
        const r = edit.insertText(lines, cursor, text, false, () => ({
          lines,
          cursor,
        }));
        return r;
      },
    );
    this.state.lines = result.lines;
    this.state.cursor = result.cursor;
  }

  private applyDeleteEdit(
    editFn: (
      lines: string[],
      cursor: Cursor,
      hasSel: boolean,
      delSel: () => {
        lines: string[];
        cursor: Cursor;
        selectionAnchor: Cursor | null;
      },
      range: { start: Cursor; end: Cursor } | null,
      anchor: Cursor | null,
    ) => { lines: string[]; cursor: Cursor; selectionAnchor: Cursor | null },
  ): void {
    this.saveState();
    const selectionRange = selection.getSelectionRange(
      this.state.selectionAnchor,
      this.state.cursor,
    );
    const result = editFn(
      this.state.lines,
      this.state.cursor,
      this.hasSelection(),
      () => ({
        lines: this.state.lines,
        cursor: this.state.cursor,
        selectionAnchor: null,
      }),
      selectionRange,
      this.state.selectionAnchor,
    );
    this.state.lines = result.lines;
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
  }

  moveCursor(
    direction: "up" | "down" | "left" | "right",
    select = false,
  ): void {
    const result = move.moveCursor(
      this.state.lines,
      this.state.cursor,
      this.state.selectionAnchor,
      this.state.viewHeight,
      this.state.topLine,
      direction,
      select,
    );
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
    this.state.topLine = result.topLine;
  }

  moveToLineStart(select = false): void {
    this.applyLineMove(move.moveToLineStart, select);
  }

  moveToLineEnd(select = false): void {
    this.applyLineMove(move.moveToLineEnd, select);
  }

  private applyLineMove(
    fn: (
      c: Cursor,
      a: Cursor | null,
      l: string,
      s: boolean,
    ) => {
      cursor: Cursor;
      selectionAnchor: Cursor | null;
    },
    select: boolean,
  ): void {
    const result = fn(
      this.state.cursor,
      this.state.selectionAnchor,
      this.state.lines[this.state.cursor.line] ?? "",
      select,
    );
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
  }

  setCursor(line: number, col = 0, clearSelection = true): void {
    const result = move.setCursor(
      this.state.lines,
      this.state.cursor,
      this.state.selectionAnchor,
      line,
      col,
      clearSelection,
    );
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
  }

  movePageUp(select = false): void {
    this.applyPageMove(move.movePageUp, select);
  }

  movePageDown(select = false): void {
    this.applyPageMove(move.movePageDown, select);
  }

  private applyPageMove(
    fn: typeof move.movePageUp | typeof move.movePageDown,
    select: boolean,
  ): void {
    const result = fn(
      this.state.lines,
      this.state.cursor,
      this.state.selectionAnchor,
      this.state.viewHeight,
      this.state.topLine,
      select,
    );
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
    this.state.topLine = result.topLine;
  }

  moveWordLeft(select = false): void {
    const result = move.moveWordLeft(
      this.state.lines,
      this.state.cursor,
      this.state.selectionAnchor,
      select,
    );
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
  }

  moveWordRight(select = false): void {
    const result = move.moveWordRight(
      this.state.lines,
      this.state.cursor,
      this.state.selectionAnchor,
      select,
    );
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
  }

  deleteWordBackward(): void {
    this.applyDeleteEdit(edit.deleteWordBackward);
  }

  deleteWordForward(): void {
    this.applyDeleteEdit(edit.deleteWordForward);
  }

  deleteLine(): void {
    this.applyDeleteEdit(edit.deleteLine);
  }

  toggleComment(): void {
    this.saveState();
    const result = edit.toggleComment(
      this.state.lines,
      this.state.cursor,
      this.state.lines[this.state.cursor.line] ?? "",
    );
    this.state.lines = result.lines;
    this.state.cursor = result.cursor;
  }

  replaceSelection(text: string): void {
    this.saveState();
    const selectionRange = selection.getSelectionRange(
      this.state.selectionAnchor,
      this.state.cursor,
    );
    const result = edit.replaceSelection(
      this.state.lines,
      this.state.cursor,
      this.state.selectionAnchor,
      selectionRange,
      text,
    );
    this.state.lines = result.lines;
    this.state.cursor = result.cursor;
    this.state.selectionAnchor = result.selectionAnchor;
  }

  undo(): boolean {
    const state = this.history.undo(this.captureState());
    if (state) {
      this.restoreState(state);
      return true;
    }
    return false;
  }

  redo(): boolean {
    const state = this.history.redo(this.captureState());
    if (state) {
      this.restoreState(state);
      return true;
    }
    return false;
  }

  private saveState(): void {
    this.history.saveState(this.captureState());
  }

  private captureState(): EditorState {
    return captureState(this.state);
  }

  private restoreState(state: EditorState): void {
    restoreState(this.state, state);
  }
}
