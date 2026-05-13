import { History } from "./history";
import * as move from "./move";
import * as edit from "./edit";
import * as selection from "./selection";
import type { Cursor, EditorState } from "./types";

export class Editor {
  private lines: string[] = [""];
  private cursor: Cursor = { line: 0, col: 0 };
  private selectionAnchor: Cursor | null = null;
  private topLine = 0;
  private history = new History();
  private viewHeight = 20;

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
      this.selectionAnchor,
      this.cursor,
    );
    const result = editFn(
      this.lines,
      this.cursor,
      this.hasSelection(),
      () => ({ lines: this.lines, cursor: this.cursor, selectionAnchor: null }),
      selectionRange,
      this.selectionAnchor,
    );
    this.lines = result.lines;
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
  }

  constructor(content: string = "") {
    this.setContent(content);
  }

  setViewHeight(height: number): void {
    this.viewHeight = Math.max(1, height);
  }

  getLines(): readonly string[] {
    return this.lines;
  }

  getCursor(): Cursor {
    return { ...this.cursor };
  }

  getSelection(): { start: Cursor; end: Cursor } | null {
    return selection.getSelectionRange(this.selectionAnchor, this.cursor);
  }

  hasSelection(): boolean {
    return (
      selection.getSelectionRange(this.selectionAnchor, this.cursor) !== null
    );
  }

  clearSelection(): void {
    this.selectionAnchor = null;
  }

  selectAll(): void {
    this.selectionAnchor = { line: 0, col: 0 };
    const lastLine = Math.max(0, this.lines.length - 1);
    this.cursor = { line: lastLine, col: this.lines[lastLine]?.length ?? 0 };
    this.adjustScroll();
  }

  getSelectedText(): string {
    const range = selection.getSelectionRange(
      this.selectionAnchor,
      this.cursor,
    );
    if (!range) return "";
    const content = this.getContent();
    const startOffset = this.offsetFromCursor(range.start);
    const endOffset = this.offsetFromCursor(range.end);
    return content.slice(startOffset, endOffset);
  }

  getTopLine(): number {
    return this.topLine;
  }

  getContent(): string {
    return this.lines.join("\n");
  }

  setContent(content: string): void {
    const lines = content.split("\n");
    this.lines = lines.length > 0 ? lines : [""];
    this.cursor = { line: 0, col: 0 };
    this.selectionAnchor = null;
    this.topLine = 0;
    this.history.clear();
  }

  setSelection(start: Cursor, end: Cursor): void {
    this.selectionAnchor = { ...start };
    this.cursor = { ...end };
    this.adjustScroll();
  }

  insertPair(open: string, close: string): void {
    const selectionRange = selection.getSelectionRange(
      this.selectionAnchor,
      this.cursor,
    );
    const result = edit.insertPair(
      this.lines,
      this.cursor,
      this.selectionAnchor,
      selectionRange,
      this.getSelectedText(),
      (c: Cursor) => this.offsetFromCursor(c),
      (o: number) => this.cursorFromOffset(o),
      open,
      close,
    );
    this.lines = result.lines;
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
  }

  insertChar(char: string): void {
    this.saveState();
    const result = edit.insertChar(this.lines, this.cursor, char);
    this.lines = result.lines;
    this.cursor = result.cursor;
  }

  insertText(text: string): void {
    if (!text) return;
    if (this.hasSelection()) {
      this.replaceSelection(text);
      return;
    }
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parts = normalized.split("\n");
    const line = this.currentLine();
    const before = line.slice(0, this.cursor.col);
    const after = line.slice(this.cursor.col);

    if (parts.length === 1) {
      this.saveState();
      this.lines[this.cursor.line] = before + parts[0]! + after;
      this.cursor.col += parts[0]!.length;
    } else {
      this.saveState();
      const first = parts[0] ?? "";
      this.lines[this.cursor.line] = before + first;
      const middle = parts.slice(1, -1);
      const last = parts[parts.length - 1] ?? "";
      const insertLines = [...middle, last + after];

      this.lines.splice(this.cursor.line + 1, 0, ...insertLines);
      this.cursor.line += insertLines.length;
      this.cursor.col = last.length;
      this.adjustScroll();
    }
  }

  deleteCharBackward(): void {
    this.applyDeleteEdit(edit.deleteCharBackward);
  }

  deleteCharForward(): void {
    this.applyDeleteEdit(edit.deleteCharForward);
  }

  insertNewline(): void {
    const result = edit.insertNewline(
      this.lines,
      this.cursor,
      this.hasSelection(),
      (lines, cursor, text) => {
        this.saveState();
        const r = edit.insertText(lines, cursor, text, false, () => ({
          lines,
          cursor,
        }));
        return r;
      },
    );
    this.lines = result.lines;
    this.cursor = result.cursor;
  }

  moveCursor(
    direction: "up" | "down" | "left" | "right",
    select = false,
  ): void {
    const result = move.moveCursor(
      this.lines,
      this.cursor,
      this.selectionAnchor,
      this.viewHeight,
      this.topLine,
      direction,
      select,
    );
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
    this.topLine = result.topLine;
  }

  moveToLineStart(select = false): void {
    const result = move.moveToLineStart(
      this.cursor,
      this.selectionAnchor,
      this.currentLine(),
      select,
    );
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
  }

  moveToLineEnd(select = false): void {
    const result = move.moveToLineEnd(
      this.cursor,
      this.selectionAnchor,
      this.currentLine(),
      select,
    );
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
  }

  setCursor(line: number, col = 0, clearSelection = true): void {
    const result = move.setCursor(
      this.lines,
      this.cursor,
      this.selectionAnchor,
      line,
      col,
      clearSelection,
    );
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
  }

  private applyPageMove(
    fn: typeof move.movePageUp | typeof move.movePageDown,
    select: boolean,
  ): void {
    const result = fn(
      this.lines,
      this.cursor,
      this.selectionAnchor,
      this.viewHeight,
      this.topLine,
      select,
    );
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
    this.topLine = result.topLine;
  }

  movePageUp(select = false): void {
    this.applyPageMove(move.movePageUp, select);
  }

  movePageDown(select = false): void {
    this.applyPageMove(move.movePageDown, select);
  }

  moveWordLeft(select = false): void {
    const result = move.moveWordLeft(
      this.lines,
      this.cursor,
      this.selectionAnchor,
      select,
    );
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
  }

  moveWordRight(select = false): void {
    const result = move.moveWordRight(
      this.lines,
      this.cursor,
      this.selectionAnchor,
      select,
    );
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
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
      this.lines,
      this.cursor,
      this.currentLine(),
    );
    this.lines = result.lines;
    this.cursor = result.cursor;
  }

  replaceSelection(text: string): void {
    this.saveState();
    const selectionRange = selection.getSelectionRange(
      this.selectionAnchor,
      this.cursor,
    );
    const result = edit.replaceSelection(
      this.lines,
      this.cursor,
      this.selectionAnchor,
      selectionRange,
      text,
    );
    this.lines = result.lines;
    this.cursor = result.cursor;
    this.selectionAnchor = result.selectionAnchor;
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

  private currentLine(): string {
    return this.lines[this.cursor.line] ?? "";
  }

  private saveState(): void {
    this.history.saveState(this.captureState());
  }

  private captureState(): EditorState {
    return {
      lines: [...this.lines],
      cursor: { ...this.cursor },
      topLine: this.topLine,
      selectionAnchor: this.selectionAnchor
        ? { ...this.selectionAnchor }
        : null,
    };
  }

  private restoreState(state: EditorState): void {
    this.lines = state.lines;
    this.cursor = state.cursor;
    this.topLine = state.topLine;
    this.selectionAnchor = state.selectionAnchor
      ? { ...state.selectionAnchor }
      : null;
  }

  offsetFromCursor(cursor: Cursor): number {
    let offset = 0;
    for (let i = 0; i < cursor.line; i++) {
      offset += (this.lines[i]?.length ?? 0) + 1;
    }
    offset += cursor.col;
    return offset;
  }

  cursorFromOffset(offset: number): Cursor {
    const found = this.findLineForOffset(Math.max(0, offset));
    if (found) return found;
    const lastLine = Math.max(0, this.lines.length - 1);
    return { line: lastLine, col: this.lines[lastLine]?.length ?? 0 };
  }

  private findLineForOffset(offset: number): Cursor | null {
    let remaining = offset;
    for (let i = 0; i < this.lines.length; i++) {
      const length = this.lines[i]?.length ?? 0;
      if (remaining <= length) return { line: i, col: remaining };
      remaining -= length + 1;
    }
    return null;
  }

  private adjustScroll(): void {
    if (this.cursor.line < this.topLine) {
      this.topLine = this.cursor.line;
    }
    if (this.cursor.line >= this.topLine + this.viewHeight) {
      this.topLine = this.cursor.line - this.viewHeight + 1;
    }
  }
}
