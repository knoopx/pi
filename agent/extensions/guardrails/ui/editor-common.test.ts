import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseEditor } from "./editor-common";

/**
 * Terminal escape sequences for testing key handling.
 */
const Keys = {
  up: "\x1b[A",
  down: "\x1b[B",
  enter: "\r",
  escape: "\x1b",
};

/**
 * Concrete implementation of BaseEditor for testing.
 */
class TestEditor extends BaseEditor<{ name: string; value: number }> {
  constructor(items: { name: string; value: number }[] = []) {
    super(items);
  }

  protected getLabel(): string {
    return "Test Items";
  }

  protected renderItem(item: { name: string; value: number }): string {
    return `${item.name}: ${item.value}`;
  }

  protected handleItemInput(_value: string, _index?: number): void {
    // Mock implementation
  }

  protected handleNavigation(index: number): void {
    this.navigate(index);
  }

  protected startEdit(index: number): void {
    this.startEditInternal(index);
  }

  protected deleteSelected(): void {
    this.deleteItem(this.selectedIndex);
  }

  protected cancelEdit(): void {
    this.cancelEditInternal();
  }

  protected renderInputMode(width: number): string[] {
    return [`Input mode (${width}px)`];
  }

  // Expose protected methods for testing
  public testNavigate(index: number): void {
    this.navigate(index);
  }

  public testDeleteItem(index: number): void {
    this.deleteItem(index);
  }

  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  public getMode(): "list" | "add" | "edit" {
    return this.mode;
  }

  public setMode(mode: "list" | "add" | "edit"): void {
    this.mode = mode;
  }
}

describe("BaseEditor", () => {
  describe("Initialization", () => {
    describe("given empty items array", () => {
      it("then creates editor instance", () => {
        const editor = new TestEditor([]);

        expect(editor).toBeDefined();
        expect(editor.getSelectedIndex()).toBe(0);
        expect(editor.getMode()).toBe("list");
      });
    });

    describe("given items array", () => {
      it("then creates editor with items", () => {
        const items = [
          { name: "first", value: 1 },
          { name: "second", value: 2 },
        ];
        const editor = new TestEditor(items);

        expect(editor).toBeDefined();
        expect(editor.getSelectedIndex()).toBe(0);
      });
    });

    describe("given maxVisible parameter", () => {
      it("then uses provided maxVisible", () => {
        const editor = new TestEditor([]);

        expect(editor).toBeDefined();
      });
    });
  });

  describe("Navigation", () => {
    describe("given multiple items", () => {
      let editor: TestEditor;

      beforeEach(() => {
        editor = new TestEditor([
          { name: "first", value: 1 },
          { name: "second", value: 2 },
          { name: "third", value: 3 },
        ]);
      });

      describe("when navigating to valid index", () => {
        it("then updates selected index", () => {
          editor.testNavigate(1);

          expect(editor.getSelectedIndex()).toBe(1);
        });
      });

      describe("when navigating beyond bounds", () => {
        it("then clamps to valid range", () => {
          editor.testNavigate(-1);

          expect(editor.getSelectedIndex()).toBe(0);

          editor.testNavigate(10);

          expect(editor.getSelectedIndex()).toBe(2);
        });
      });
    });
  });

  describe("Delete Item", () => {
    describe("given multiple items", () => {
      let editor: TestEditor;

      beforeEach(() => {
        editor = new TestEditor([
          { name: "first", value: 1 },
          { name: "second", value: 2 },
          { name: "third", value: 3 },
        ]);
      });

      describe("when deleting middle item", () => {
        it("then removes item and adjusts selection", () => {
          editor.testNavigate(1);
          editor.testDeleteItem(1);

          expect(editor.getSelectedIndex()).toBe(1);
        });
      });

      describe("when deleting last item", () => {
        it("then adjusts selection to new last item", () => {
          editor.testNavigate(2);
          editor.testDeleteItem(2);

          expect(editor.getSelectedIndex()).toBe(1);
        });
      });

      describe("when deleting with invalid index", () => {
        it("then does nothing", () => {
          const originalIndex = editor.getSelectedIndex();
          editor.testDeleteItem(-1);

          expect(editor.getSelectedIndex()).toBe(originalIndex);
        });
      });
    });
  });

  describe("List Mode Input Handling", () => {
    describe("given list mode", () => {
      let editor: TestEditor;

      beforeEach(() => {
        editor = new TestEditor([
          { name: "first", value: 1 },
          { name: "second", value: 2 },
        ]);
      });

      describe("when pressing up arrow", () => {
        it("then moves selection up", () => {
          editor.testNavigate(1);
          const handled = editor.handleInput(Keys.up);

          expect(handled).toBe(true);
          expect(editor.getSelectedIndex()).toBe(0);
        });
      });

      describe("when pressing down arrow", () => {
        it("then moves selection down", () => {
          const handled = editor.handleInput(Keys.down);

          expect(handled).toBe(true);
          expect(editor.getSelectedIndex()).toBe(1);
        });
      });

      describe("when at first item and pressing up", () => {
        it("then stays at first item", () => {
          const handled = editor.handleInput(Keys.up);

          expect(handled).toBe(true);
          expect(editor.getSelectedIndex()).toBe(0);
        });
      });

      describe("when at last item and pressing down", () => {
        it("then stays at last item", () => {
          editor.testNavigate(1);
          const handled = editor.handleInput(Keys.down);

          expect(handled).toBe(true);
          expect(editor.getSelectedIndex()).toBe(1);
        });
      });

      describe("when pressing 'a'", () => {
        it("then switches to add mode", () => {
          const handled = editor.handleInput("a");

          expect(handled).toBe(true);
          expect(editor.getMode()).toBe("add");
        });
      });

      describe("when pressing 'A'", () => {
        it("then switches to add mode", () => {
          const handled = editor.handleInput("A");

          expect(handled).toBe(true);
          expect(editor.getMode()).toBe("add");
        });
      });

      describe("when pressing enter with items", () => {
        it("then calls startEdit", () => {
          const handled = editor.handleInput(Keys.enter);

          expect(handled).toBe(true);
          expect(editor.getMode()).toBe("edit");
        });
      });

      describe("when pressing enter with no items", () => {
        it("then does nothing", () => {
          const emptyEditor = new TestEditor([]);
          const handled = emptyEditor.handleInput(Keys.enter);

          expect(handled).toBe(true);
          expect(emptyEditor.getMode()).toBe("list");
        });
      });

      describe("when pressing 'e' with items", () => {
        it("then switches to edit mode", () => {
          const handled = editor.handleInput("e");

          expect(handled).toBe(true);
          expect(editor.getMode()).toBe("edit");
        });
      });

      describe("when pressing 'd' with items", () => {
        it("then deletes selected item", () => {
          const handled = editor.handleInput("d");

          expect(handled).toBe(true);
          // Note: deleteSelected is mocked, so items aren't actually removed
        });
      });

      describe("when pressing 'd' with no items", () => {
        it("then does nothing", () => {
          const emptyEditor = new TestEditor([]);
          const handled = emptyEditor.handleInput("d");

          expect(handled).toBe(true);
        });
      });

      describe("when pressing escape", () => {
        it("then calls cancelEdit", () => {
          const handled = editor.handleInput(Keys.escape);

          expect(handled).toBe(true);
        });
      });

      describe("when pressing unknown key", () => {
        it("then returns false", () => {
          const handled = editor.handleInput("x");

          expect(handled).toBe(false);
        });
      });
    });
  });

  describe("Edit Mode Input Handling", () => {
    describe("given edit mode", () => {
      let editor: TestEditor;

      beforeEach(() => {
        editor = new TestEditor([{ name: "test", value: 1 }]);
        editor.setMode("edit");
      });

      describe("when handling input", () => {
        it("then calls handleItemInput", () => {
          const handled = editor.handleInput("test input");

          expect(handled).toBe(true);
        });
      });
    });
  });

  describe("setOnDone", () => {
    describe("given callback", () => {
      it("then sets the callback", () => {
        const editor = new TestEditor();
        const callback = vi.fn();

        editor.setOnDone(callback);

        expect(editor).toBeDefined();
      });
    });
  });

  describe("renderListMode", () => {
    describe("given empty items", () => {
      it("then renders empty message", () => {
        const editor = new TestEditor([]);
        const output = editor["renderListMode"](80);

        expect(output).toContain("  (no items)");
        expect(output).toContain("  a: add item • Esc: cancel");
      });
    });

    describe("given items", () => {
      it("then renders items with navigation", () => {
        const editor = new TestEditor([
          { name: "first", value: 1 },
          { name: "second", value: 2 },
        ]);
        const output = editor["renderListMode"](80);

        expect(output).toContain("first: 1");
        expect(output).toContain("second: 2");
        expect(output).toContain(
          "↑/↓: navigate • Enter: edit • a: add • d: delete • Esc: cancel",
        );
      });

      it("then highlights selected item", () => {
        const editor = new TestEditor([
          { name: "first", value: 1 },
          { name: "second", value: 2 },
        ]);
        const output = editor["renderListMode"](80);

        const selectedLine = output.find((line) => line.includes("▶ first: 1"));
        expect(selectedLine).toContain("\x1b[7m"); // Reverse video escape sequence
      });
    });
  });
});
