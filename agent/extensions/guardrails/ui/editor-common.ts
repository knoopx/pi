import { Key, matchesKey, Input } from "@mariozechner/pi-tui";

/**
 * Base class for array editors that manage list and form modes.
 */
export abstract class BaseEditor<T> {
  protected items: T[];
  protected selectedIndex: number = 0;
  protected mode: "list" | "add" | "edit" = "list";
  protected editIndex: number = -1;
  protected maxVisible: number;
  protected onDone?: () => void;
  protected input: Input;

  constructor(items: T[], maxVisible: number = 10) {
    this.items = [...items];
    this.maxVisible = maxVisible;
    this.input = new Input();
  }

  /**
   * Set the callback for when editing is done/cancelled.
   */
  setOnDone(callback: () => void): void {
    this.onDone = callback;
  }

  /**
   * Get the label for this editor.
   */
  protected abstract getLabel(): string;

  /**
   * Render a single item in list mode.
   */
  protected abstract renderItem(item: T): string;

  /**
   * Handle input when in form mode (add/edit).
   */
  protected abstract handleItemInput(value: string, index?: number): void;

  /**
   * Handle navigation to a specific index.
   */
  protected abstract handleNavigation(index: number): void;

  /**
   * Start editing an existing item.
   */
  protected abstract startEdit(index: number): void;

  /**
   * Delete the selected item.
   */
  protected abstract deleteSelected(): void;

  /**
   * Cancel the current edit/add operation.
   */
  protected abstract cancelEdit(): void;

  /**
   * Render the input mode (add/edit form).
   */
  protected abstract renderInputMode(width: number): string[];

  /**
   * Navigate to a specific index.
   */
  protected navigate(index: number): void {
    this.selectedIndex = Math.max(0, Math.min(this.items.length - 1, index));
  }

  /**
   * Delete an item at the specified index.
   */
  protected deleteItem(index: number): void {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
      this.selectedIndex = Math.max(
        0,
        Math.min(this.selectedIndex, this.items.length - 1),
      );
    }
  }

  /**
   * Start editing an item (internal implementation).
   */
  protected startEditInternal(index: number): void {
    this.mode = "edit";
    this.editIndex = index;
  }

  /**
   * Cancel editing (internal implementation).
   */
  protected cancelEditInternal(): void {
    this.mode = "list";
    this.editIndex = -1;
  }

  /**
   * Handle input in list mode.
   */
  handleInput(data: string): boolean {
    if (this.mode === "list") {
      return this.handleListInput(data);
    } else {
      this.handleItemInput(data);
      return true;
    }
  }

  private handleListInput(data: string): boolean {
    // Navigation
    if (matchesKey(data, Key.up)) {
      this.navigate(this.selectedIndex - 1);
      return true;
    }
    if (matchesKey(data, Key.down)) {
      this.navigate(this.selectedIndex + 1);
      return true;
    }

    // Actions
    if (data === "a" || data === "A") {
      this.mode = "add";
      return true;
    }

    if (data === "e" || data === "E" || matchesKey(data, Key.enter)) {
      if (this.items.length > 0) {
        this.startEdit(this.selectedIndex);
      }
      return true;
    }

    if (data === "d" || data === "D") {
      if (this.items.length > 0) {
        this.deleteSelected();
      }
      return true;
    }

    if (matchesKey(data, Key.escape)) {
      this.cancelEdit();
      return true;
    }

    return false;
  }

  /**
   * Render the editor.
   */
  render(width: number): string[] {
    const lines: string[] = [];
    lines.push(` ${this.getLabel()}`);
    lines.push("");

    if (this.mode === "add" || this.mode === "edit") {
      return [...lines, ...this.renderInputMode(width)];
    }
    return [...lines, ...this.renderListMode(width)];
  }

  /**
   * Render the list mode.
   */
  protected renderListMode(_width: number): string[] {
    const lines: string[] = [];

    if (this.items.length === 0) {
      lines.push("  (no items)");
      lines.push("");
      lines.push("  a: add item • Esc: cancel");
      return lines;
    }

    // Render visible items
    const start = Math.max(
      0,
      this.selectedIndex - Math.floor(this.maxVisible / 2),
    );
    const end = Math.min(this.items.length, start + this.maxVisible);

    for (let i = start; i < end; i++) {
      const item = this.items[i];
      if (!item) continue;

      const prefix = i === this.selectedIndex ? "▶ " : "  ";
      const rendered = this.renderItem(item);
      const line = `${prefix}${rendered}`;
      lines.push(i === this.selectedIndex ? `\x1b[7m${line}\x1b[27m` : line);
    }

    lines.push("");
    lines.push(
      "  ↑/↓: navigate • Enter: edit • a: add • d: delete • Esc: cancel",
    );

    return lines;
  }

  /**
   * Invalidate the editor (for refresh).
   */
  invalidate(): void {
    // Override in subclasses if needed
  }
}
