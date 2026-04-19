import { History } from "./history";
import {
  clampCol,
  findWordBoundaryBackward,
  findWordBoundaryForward,
  getLeadingWhitespace,
  moveWordLeftOnLine,
  moveWordRightOnLine,
} from "./helpers";
import type { Cursor, EditorState } from "./types";

function cursorsEqual(a: Cursor, b: Cursor): boolean {
  return a.line === b.line && a.col === b.col;
}

function compareCursor(a: Cursor, b: Cursor): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.col - b.col;
}

export class Editor {
  private lines: string[] = [""];
  private cursor: Cursor = { line: 0, col: 0 };
  private selectionAnchor: Cursor | null = null;
  private topLine = 0;
  private history = new History();
  private viewHeight = 20;

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
    return this.getSelectionRange();
  }

  hasSelection(): boolean {
    return this.getSelectionRange() !== null;
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
    const range = this.getSelectionRange();
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
    const selection = this.getSelectionRange();
    if (selection) {
      const selectedText = this.getSelectedText();
      const startOffset = this.offsetFromCursor(selection.start);
      this.replaceRange(
        selection.start,
        selection.end,
        `${open}${selectedText}${close}`,
      );
      const newStart = this.cursorFromOffset(startOffset + 1);
      const newEnd = this.cursorFromOffset(
        startOffset + 1 + selectedText.length,
      );
      this.setSelection(newStart, newEnd);
      return;
    }

    const insertOffset = this.offsetFromCursor(this.cursor);
    this.insertText(`${open}${close}`);
    const newCursor = this.cursorFromOffset(insertOffset + 1);
    this.setCursor(newCursor.line, newCursor.col);
  }

  deleteSelection(): void {
    const range = this.getSelectionRange();
    if (!range) return;
    this.replaceRange(range.start, range.end, "");
    this.selectionAnchor = null;
  }

  insertChar(char: string): void {
    this.insertText(char);
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
      this.insertSingleLine(before, parts[0] ?? "", after);
    } else {
      this.insertMultiLine(before, parts, after);
    }
  }

  private insertSingleLine(before: string, text: string, after: string): void {
    this.saveState();
    this.lines[this.cursor.line] = before + text + after;
    this.cursor.col += text.length;
  }

  private insertMultiLine(
    before: string,
    parts: string[],
    after: string,
  ): void {
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

  deleteCharBackward(): void {
    if (this.hasSelection()) {
      this.deleteSelection();
      return;
    }
    if (this.cursor.col > 0) {
      this.saveState();
      const line = this.currentLine();
      this.lines[this.cursor.line] =
        line.slice(0, this.cursor.col - 1) + line.slice(this.cursor.col);
      this.cursor.col--;
    } else if (this.cursor.line > 0) {
      this.joinWithPreviousLine();
    }
  }

  deleteCharForward(): void {
    if (this.hasSelection()) {
      this.deleteSelection();
      return;
    }
    const line = this.currentLine();
    if (this.cursor.col < line.length) {
      this.saveState();
      this.lines[this.cursor.line] =
        line.slice(0, this.cursor.col) + line.slice(this.cursor.col + 1);
    } else if (this.cursor.line < this.lines.length - 1) {
      this.joinWithNextLine();
    }
  }

  insertNewline(): void {
    if (this.hasSelection()) {
      this.replaceSelection("\n");
      return;
    }
    this.saveState();
    const line = this.currentLine();
    const beforeCursor = line.slice(0, this.cursor.col);
    const afterCursor = line.slice(this.cursor.col);
    const indent = getLeadingWhitespace(beforeCursor);

    this.lines[this.cursor.line] = beforeCursor;
    this.lines.splice(this.cursor.line + 1, 0, indent + afterCursor);
    this.cursor.line++;
    this.cursor.col = indent.length;
    this.adjustScroll();
  }

  moveCursor(
    direction: "up" | "down" | "left" | "right",
    select = false,
  ): void {
    this.beginSelection(select);
    this.executeMove(direction);
    this.finalizeSelection();
    this.adjustScroll();
  }

  private executeMove(direction: "up" | "down" | "left" | "right"): void {
    const moves = {
      up: () => {
        this.moveUp();
      },
      down: () => {
        this.moveDown();
      },
      left: () => {
        this.moveLeft();
      },
      right: () => {
        this.moveRight();
      },
    };
    moves[direction]();
  }

  moveToLineStart(select = false): void {
    this.beginSelection(select);
    const line = this.currentLine();
    const firstNonSpace = line.search(/\S/);

    if (firstNonSpace === -1 || this.cursor.col === firstNonSpace) {
      this.cursor.col = 0;
    } else {
      this.cursor.col = firstNonSpace;
    }
    this.finalizeSelection();
  }

  moveToLineEnd(select = false): void {
    this.beginSelection(select);
    this.cursor.col = this.currentLine().length;
    this.finalizeSelection();
  }

  setCursor(line: number, col: number = 0, clearSelection = true): void {
    const clampedLine = Math.max(0, Math.min(line, this.lines.length - 1));
    this.cursor.line = clampedLine;
    this.cursor.col = Math.max(0, Math.min(col, this.currentLine().length));
    if (clearSelection) {
      this.selectionAnchor = null;
    }
    this.adjustScroll();
  }

  replaceRange(start: Cursor, end: Cursor, text: string): void {
    this.saveState();

    const content = this.getContent();
    const startOffset = this.offsetFromCursor(start);
    const endOffset = this.offsetFromCursor(end);
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    const nextContent =
      content.slice(0, startOffset) + normalized + content.slice(endOffset);
    this.lines = nextContent.split("\n");

    const newOffset = startOffset + normalized.length;
    const newCursor = this.cursorFromOffset(newOffset);
    this.cursor = newCursor;
    this.selectionAnchor = null;
    this.adjustScroll();
  }

  movePageUp(select = false): void {
    this.beginSelection(select);
    const pageMoveCount = Math.max(1, this.viewHeight - 1);
    for (let i = 0; i < pageMoveCount; i++) {
      if (this.cursor.line === 0) break;
      this.cursor.line--;
    }
    clampCol(this.lines, this.cursor);
    this.finalizeSelection();
    this.adjustScroll();
  }

  movePageDown(select = false): void {
    this.beginSelection(select);
    const pageMoveCount = Math.max(1, this.viewHeight - 1);
    const lastLine = this.lines.length - 1;
    for (let i = 0; i < pageMoveCount; i++) {
      if (this.cursor.line >= lastLine) break;
      this.cursor.line++;
    }
    clampCol(this.lines, this.cursor);
    this.finalizeSelection();
    this.adjustScroll();
  }

  moveWordLeft(select = false): void {
    this.beginSelection(select);
    if (this.cursor.col === 0 && this.cursor.line > 0) {
      this.cursor.line--;
      this.cursor.col = this.currentLine().length;
    } else {
      moveWordLeftOnLine(this.lines, this.cursor);
    }
    this.finalizeSelection();
  }

  moveWordRight(select = false): void {
    this.beginSelection(select);
    const line = this.currentLine();
    if (
      this.cursor.col >= line.length &&
      this.cursor.line < this.lines.length - 1
    ) {
      this.cursor.line++;
      this.cursor.col = 0;
    } else {
      moveWordRightOnLine(this.lines, this.cursor);
    }
    this.finalizeSelection();
  }

  deleteWordBackward(): void {
    if (this.hasSelection()) {
      this.deleteSelection();
      return;
    }

    const line = this.currentLine() ?? "";
    const col = this.cursor.col;

    if (this.atFileStart()) return;
    if (this.joinLineBackward(line)) return;

    const deleteEnd = findWordBoundaryBackward(line, col);
    if (deleteEnd < col) {
      this.deleteRangeInLine(deleteEnd, col);
    }
  }

  private atFileStart(): boolean {
    return this.cursor.col === 0 && this.cursor.line === 0;
  }

  private deleteRangeInLine(from: number, to: number): void {
    this.saveState();
    const line = this.currentLine() ?? "";
    this.lines[this.cursor.line] = line.slice(0, from) + line.slice(to);
    this.cursor.col = from;
  }

  deleteWordForward(): void {
    if (this.hasSelection()) {
      this.deleteSelection();
      return;
    }

    const line = this.currentLine() ?? "";
    const col = this.cursor.col;
    const lineLen = line.length;

    if (this.atFileEnd(lineLen)) return;
    if (this.joinLineForward(line)) return;

    const deleteEnd = findWordBoundaryForward(line, col, lineLen);
    if (deleteEnd > col) {
      this.deleteRangeInLine(col, deleteEnd);
    }
  }

  private atFileEnd(lineLen: number): boolean {
    return (
      this.cursor.col === lineLen && this.cursor.line === this.lines.length - 1
    );
  }

  private joinLineBackward(line: string): boolean {
    if (this.cursor.col !== 0 || this.cursor.line === 0) return false;
    this.saveState();
    const prevLine = this.lines[this.cursor.line - 1] ?? "";
    const newLine = prevLine + line;
    this.lines.splice(this.cursor.line, 2, newLine);
    this.cursor.col = newLine.length;
    return true;
  }

  private joinLineForward(line: string): boolean {
    if (
      this.cursor.col !== line.length ||
      this.cursor.line >= this.lines.length - 1
    )
      return false;
    this.saveState();
    const nextLine = this.lines[this.cursor.line + 1] ?? "";
    const newLine = line + nextLine;
    this.lines.splice(this.cursor.line, 2, newLine);
    return true;
  }

  deleteLine(): void {
    if (this.hasSelection()) {
      this.deleteSelection();
      return;
    }
    this.saveState();

    if (this.lines.length === 1) {
      this.clearOnlyLine();
      return;
    }

    this.lines.splice(this.cursor.line, 1);
    this.adjustCursorAfterDelete();
    this.adjustScroll();
  }

  private clearOnlyLine(): void {
    this.lines[0] = "";
    this.cursor.col = 0;
  }

  private adjustCursorAfterDelete(): void {
    if (this.cursor.line >= this.lines.length) {
      this.cursor.line = this.lines.length - 1;
      this.cursor.col = (this.currentLine() ?? "").length;
    } else {
      this.cursor.col = 0;
    }
  }

  toggleComment(): void {
    this.saveState();

    const line = this.currentLine();
    const trimmed = line.trim();

    if (trimmed.startsWith("//")) {
      const uncommented = line.replace(/^(\s*)\/\/\s?/, "$1");
      this.lines[this.cursor.line] = uncommented;
      if (this.cursor.col >= uncommented.length) {
        this.cursor.col = uncommented.length;
      }
    } else {
      const indent = getLeadingWhitespace(line);
      const commented = indent + "// " + line.slice(indent.length);
      this.lines[this.cursor.line] = commented;
      this.cursor.col += 3;
    }
  }

  replaceSelection(text: string): void {
    const range = this.getSelectionRange();
    if (!range) {
      this.insertText(text);
      return;
    }

    this.replaceRange(range.start, range.end, text);
    this.selectionAnchor = null;
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

  private beginSelection(select: boolean): void {
    if (select) {
      if (!this.selectionAnchor) {
        this.selectionAnchor = { ...this.cursor };
      }
    } else {
      this.selectionAnchor = null;
    }
  }

  private finalizeSelection(): void {
    if (!this.selectionAnchor) return;
    if (cursorsEqual(this.selectionAnchor, this.cursor)) {
      this.selectionAnchor = null;
    }
  }

  private getSelectionRange(): { start: Cursor; end: Cursor } | null {
    if (!this.selectionAnchor) return null;
    if (cursorsEqual(this.selectionAnchor, this.cursor)) return null;

    if (compareCursor(this.selectionAnchor, this.cursor) <= 0) {
      return { start: { ...this.selectionAnchor }, end: { ...this.cursor } };
    }
    return { start: { ...this.cursor }, end: { ...this.selectionAnchor } };
  }

  private joinWithPreviousLine(): void {
    this.saveState();
    const prevLine = this.lines[this.cursor.line - 1] ?? "";
    const currentLine = this.currentLine();
    this.cursor.col = prevLine.length;
    this.lines[this.cursor.line - 1] = prevLine + currentLine;
    this.lines.splice(this.cursor.line, 1);
    this.cursor.line--;
    this.adjustScroll();
  }

  private joinWithNextLine(): void {
    this.saveState();
    const line = this.currentLine();
    const nextLine = this.lines[this.cursor.line + 1] ?? "";
    this.lines[this.cursor.line] = line + nextLine;
    this.lines.splice(this.cursor.line + 1, 1);
  }

  private moveUp(): void {
    if (this.cursor.line > 0) {
      this.cursor.line--;
      clampCol(this.lines, this.cursor);
    }
  }

  private moveDown(): void {
    if (this.cursor.line < this.lines.length - 1) {
      this.cursor.line++;
      clampCol(this.lines, this.cursor);
    }
  }

  private moveLeft(): void {
    if (this.cursor.col > 0) {
      this.cursor.col--;
    } else if (this.cursor.line > 0) {
      this.cursor.line--;
      this.cursor.col = this.currentLine().length;
    }
  }

  private moveRight(): void {
    const lineLen = this.currentLine().length;
    if (this.cursor.col < lineLen) {
      this.cursor.col++;
    } else if (this.cursor.line < this.lines.length - 1) {
      this.cursor.line++;
      this.cursor.col = 0;
    }
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
