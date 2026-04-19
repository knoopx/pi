import type { EditorState } from "./types";

export class History {
  private past: EditorState[] = [];
  private future: EditorState[] = [];

  saveState(state: EditorState): void {
    this.past.push(state);
    if (this.past.length > 500) {
      this.past.shift();
    }
    this.future = [];
  }

  undo(current: EditorState): EditorState | null {
    if (this.past.length === 0) return null;
    this.future.push(current);
    const previous = this.past.pop();
    return previous ?? null;
  }

  redo(current: EditorState): EditorState | null {
    if (this.future.length === 0) return null;
    this.past.push(current);
    const next = this.future.pop();
    return next ?? null;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
