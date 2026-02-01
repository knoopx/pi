import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Terminal escape sequences for testing key handling.
 * These match what matchesKey() expects.
 */
export const Keys = {
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  left: "\x1b[D",
  enter: "\r",
  tab: "\t",
  shiftTab: "\x1b[Z",
  escape: "\x1b",
  space: " ",
};

/**
 * Common test patterns for editor components.
 */
export class EditorTestHelper<T> {
  constructor(
    private createEditor: (items: T[], overrides?: any) => any,
    private sampleItems: T[],
  ) {}

  /**
   * Test basic initialization scenarios.
   */
  testInitialization(label: string) {
    describe("Initialization", () => {
      describe("given empty items array", () => {
        describe("when creating editor", () => {
          it("then creates editor instance with empty items", () => {
            const editor = this.createEditor([]);

            expect(editor).toBeDefined();
            expect(editor["items"]).toHaveLength(0);
          });

          it("then starts in list mode", () => {
            const editor = this.createEditor([]);

            expect(editor["mode"]).toBe("list");
          });
        });
      });

      describe("given valid items", () => {
        describe("when creating editor", () => {
          it("then creates editor instance with items", () => {
            const editor = this.createEditor(this.sampleItems);

            expect(editor).toBeDefined();
            expect(editor["items"]).toHaveLength(this.sampleItems.length);
          });

          it("then stores label correctly", () => {
            const editor = this.createEditor(this.sampleItems);

            expect(editor["label"]).toBe(label);
          });

          it("then initializes with first item selected", () => {
            const editor = this.createEditor(this.sampleItems);

            expect(editor["selectedIndex"]).toBe(0);
          });
        });
      });

      describe("given maxVisible option", () => {
        describe("when creating editor", () => {
          it("then uses provided maxVisible value", () => {
            const editor = this.createEditor(this.sampleItems, {
              maxVisible: 5,
            });

            expect(editor["maxVisible"]).toBe(5);
          });

          it("then defaults to 10 when not provided", () => {
            const editor = this.createEditor(this.sampleItems);

            expect(editor["maxVisible"]).toBe(10);
          });
        });
      });
    });
  }

  /**
   * Test list mode navigation.
   */
  testListNavigation() {
    describe("List Mode Navigation", () => {
      describe("given multiple items", () => {
        let editor: any;

        beforeEach(() => {
          editor = this.createEditor(this.sampleItems);
        });

        describe("when pressing down arrow", () => {
          it("then moves selection down", () => {
            editor.handleInput(Keys.down);

            expect(editor["selectedIndex"]).toBe(1);
          });
        });

        describe("when pressing up arrow", () => {
          it("then moves selection up", () => {
            editor["selectedIndex"] = 1;
            editor.handleInput(Keys.up);

            expect(editor["selectedIndex"]).toBe(0);
          });
        });

        describe("when at first item and pressing up", () => {
          it("then stays at first item", () => {
            editor.handleInput(Keys.up);

            expect(editor["selectedIndex"]).toBe(0);
          });
        });

        describe("when at last item and pressing down", () => {
          it("then stays at last item", () => {
            editor["selectedIndex"] = this.sampleItems.length - 1;
            editor.handleInput(Keys.down);

            expect(editor["selectedIndex"]).toBe(this.sampleItems.length - 1);
          });
        });
      });
    });
  }

  /**
   * Test add mode functionality.
   */
  testAddMode(
    setupFormFields: (editor: any) => void,
    submitForm: (editor: any) => void,
    expectedItem: T,
  ) {
    describe("Add Mode", () => {
      describe("given list mode active", () => {
        let editor: any;
        let onSave: ReturnType<typeof vi.fn>;

        beforeEach(() => {
          onSave = vi.fn();
          editor = this.createEditor([], { onSave });
        });

        describe("when pressing 'a' key", () => {
          it("then switches to add mode", () => {
            editor.handleInput("a");

            expect(editor["mode"]).toBe("add");
          });
        });

        describe("when pressing 'A' key", () => {
          it("then switches to add mode", () => {
            editor.handleInput("A");

            expect(editor["mode"]).toBe("add");
          });
        });
      });

      describe("given add mode active", () => {
        let editor: any;
        let onSave: ReturnType<typeof vi.fn>;

        beforeEach(() => {
          onSave = vi.fn();
          editor = this.createEditor([], { onSave });
          editor.handleInput("a"); // Enter add mode
          setupFormFields(editor);
        });

        describe("when completing all fields and submitting", () => {
          it("then adds new item to items", () => {
            submitForm(editor);

            expect(editor["items"]).toHaveLength(1);
            expect(editor["items"][0]).toEqual(expectedItem);
          });

          it("then calls onSave with updated items", () => {
            submitForm(editor);

            expect(onSave).toHaveBeenCalledWith([expectedItem]);
          });

          it("then returns to list mode", () => {
            submitForm(editor);

            expect(editor["mode"]).toBe("list");
          });

          it("then selects newly added item", () => {
            submitForm(editor);

            expect(editor["selectedIndex"]).toBe(0);
          });
        });
      });
    });
  }

  /**
   * Test edit mode functionality.
   */
  testEditMode(
    setupEditFields: (editor: any) => void,
    submitEdit: (editor: any) => void,
    expectedItem: T,
  ) {
    describe("Edit Mode", () => {
      describe("given list mode with items", () => {
        let editor: any;
        let onSave: ReturnType<typeof vi.fn>;

        beforeEach(() => {
          onSave = vi.fn();
          editor = this.createEditor([...this.sampleItems], { onSave });
        });

        describe("when pressing enter on item", () => {
          it("then switches to edit mode", () => {
            editor.handleInput(Keys.enter);

            expect(editor["mode"]).toBe("edit");
          });
        });

        describe("when pressing 'e' on item", () => {
          it("then switches to edit mode", () => {
            editor.handleInput("e");

            expect(editor["mode"]).toBe("edit");
          });
        });
      });

      describe("given edit mode active", () => {
        let editor: any;
        let onSave: ReturnType<typeof vi.fn>;

        beforeEach(() => {
          onSave = vi.fn();
          editor = this.createEditor([...this.sampleItems], { onSave });
          editor.handleInput(Keys.enter); // Enter edit mode
          setupEditFields(editor);
        });

        describe("when modifying and submitting", () => {
          it("then updates existing item", () => {
            submitEdit(editor);

            expect(editor["items"][0]).toEqual(expectedItem);
          });

          it("then calls onSave with updated items", () => {
            submitEdit(editor);

            expect(onSave).toHaveBeenCalled();
          });
        });

        describe("when pressing escape", () => {
          it("then cancels without saving changes", () => {
            editor.handleInput(Keys.escape);

            expect(editor["items"][0]).toEqual(this.sampleItems[0]);
            expect(editor["mode"]).toBe("list");
          });
        });
      });
    });
  }

  /**
   * Test delete functionality.
   */
  testDelete() {
    describe("Delete Functionality", () => {
      describe("given list mode with items", () => {
        let editor: any;
        let onSave: ReturnType<typeof vi.fn>;

        beforeEach(() => {
          onSave = vi.fn();
          editor = this.createEditor([...this.sampleItems], { onSave });
        });

        describe("when pressing 'd' key", () => {
          it("then deletes selected item", () => {
            const originalLength = editor["items"].length;
            editor.handleInput("d");

            expect(editor["items"]).toHaveLength(originalLength - 1);
          });

          it("then calls onSave", () => {
            editor.handleInput("d");

            expect(onSave).toHaveBeenCalled();
          });
        });
      });

      describe("given empty list", () => {
        describe("when pressing 'd' key", () => {
          it("then does nothing", () => {
            const onSave = vi.fn();
            const editor = this.createEditor([], { onSave });
            editor.handleInput("d");

            expect(onSave).not.toHaveBeenCalled();
          });
        });
      });
    });
  }

  /**
   * Test done callback.
   */
  testDoneCallback() {
    describe("Done Callback", () => {
      describe("given list mode active", () => {
        describe("when pressing escape", () => {
          it("then calls onDone callback", () => {
            const onDone = vi.fn();
            const editor = this.createEditor([], { onDone });

            editor.handleInput(Keys.escape);

            expect(onDone).toHaveBeenCalled();
          });
        });
      });
    });
  }
}
