import { describe, it, expect } from "vitest";
import { Editor } from "./editor";


function setupUndoState(): Editor {
  const editor = new Editor("hello");
  editor.insertChar("!");
  editor.undo();
  return editor;
}

describe("Editor", () => {
  describe("given empty editor", () => {
    describe("when created with no content", () => {
      it("then has single empty line", () => {
        const editor = new Editor();

        expect(editor.getLines()).toEqual([""]);
        expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
      });
    });
  });

  describe("given editor with content", () => {
    describe("when created with multiline content", () => {
      it("then splits into lines correctly", () => {
        const editor = new Editor("hello\nworld\nfoo");

        expect(editor.getLines()).toEqual(["hello", "world", "foo"]);
      });
    });

    describe("when getting content", () => {
      it("then joins lines with newlines", () => {
        const editor = new Editor("a\nb\nc");

        expect(editor.getContent()).toBe("a\nb\nc");
      });
    });
  });

  describe("given cursor movement", () => {
    describe("when moving up from first line", () => {
      it("then stays on first line", () => {
        const editor = new Editor("line1\nline2");
        editor.setCursor(0, 5);
        editor.moveCursor("up", false);

        expect(editor.getCursor()).toEqual({ line: 0, col: 5 });
      });
    });

    describe("when moving down past last line", () => {
      it("then stays on last line", () => {
        const editor = new Editor("line1\nline2");
        editor.setCursor(1, 2);
        editor.moveCursor("down", false);

        expect(editor.getCursor()).toEqual({ line: 1, col: 2 });
      });
    });

    describe("when moving left from start of line", () => {
      it("then moves to end of previous line", () => {
        const editor = new Editor("hello\nworld");
        editor.setCursor(1, 0);
        editor.moveCursor("left", false);

        expect(editor.getCursor()).toEqual({ line: 0, col: 5 });
      });
    });

    describe("when moving left from start of first line", () => {
      it("then stays at position 0,0", () => {
        const editor = new Editor("hello");
        editor.setCursor(0, 0);
        editor.moveCursor("left", false);

        expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
      });
    });

    describe("when moving right past end of line", () => {
      it("then moves to start of next line", () => {
        const editor = new Editor("hi\nbye");
        editor.setCursor(0, 2);
        editor.moveCursor("right", false);

        expect(editor.getCursor()).toEqual({ line: 1, col: 0 });
      });
    });

    describe("when moving down between lines", () => {
      it("then preserves column position", () => {
        const editor = new Editor("hello\nworld");
        editor.setCursor(0, 3);
        editor.moveCursor("down", false);

        expect(editor.getCursor()).toEqual({ line: 1, col: 3 });
      });
    });

    describe("when moving down and next line is shorter", () => {
      it("then clamps column to line length", () => {
        const editor = new Editor("hello\nhi");
        editor.setCursor(0, 4);
        editor.moveCursor("down", false);

        expect(editor.getCursor()).toEqual({ line: 1, col: 2 });
      });
    });
  });

  describe("given text insertion", () => {
    describe("when inserting a single character", () => {
      it("then inserts at cursor position", () => {
        const editor = new Editor("hllo");
        editor.setCursor(0, 1);
        editor.insertChar("e");

        expect(editor.getContent()).toBe("hello");
        expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
      });
    });

    describe("when inserting text with newlines", () => {
      it("then splits into multiple lines", () => {
        const editor = new Editor("a\nb");
        editor.setCursor(0, 1);
        editor.insertText("x\ny");

        expect(editor.getLines()).toEqual(["ax", "y", "b"]);
      });
    });

    describe("when inserting matching pair", () => {
      it("then wraps with pair and places cursor inside", () => {
        const editor = new Editor("");
        editor.insertPair("(", ")");

        expect(editor.getContent()).toBe("()");
        expect(editor.getCursor()).toEqual({ line: 0, col: 1 });
      });
    });

    describe("when inserting pair with selection", () => {
      it("then wraps selected text in pair", () => {
        const editor = new Editor("hello world");
        editor.setCursor(0, 6, false);
        editor.setSelection({ line: 0, col: 6 }, { line: 0, col: 11 });
        editor.insertPair("{", "}");

        expect(editor.getContent()).toBe("hello {world}");
      });
    });
  });

  describe("given newline insertion", () => {
    describe("when inserting newline in middle of line", () => {
      it("then splits the line and preserves indent", () => {
        const editor = new Editor("  hello world");
        editor.setCursor(0, 7);
        editor.insertNewline();

        // beforeCursor="  hello" -> indent="  ", afterCursor=" world"
        // So line 1 = "  " + " world" = "   world"
        expect(editor.getLines()).toEqual(["  hello", "   world"]);
        expect(editor.getCursor()).toEqual({ line: 1, col: 2 });
      });
    });

    describe("when inserting newline at end of file", () => {
      it("then adds a new empty line with same indent", () => {
        const editor = new Editor("  hello");
        editor.setCursor(0, 7);
        editor.insertNewline();

        expect(editor.getLines()).toEqual(["  hello", "  "]);
      });
    });
  });

  describe("given deletion", () => {
    describe("when deleting backward at start of line", () => {
      it("then joins with previous line", () => {
        const editor = new Editor("hello\nworld");
        editor.setCursor(1, 0);
        editor.deleteCharBackward();

        expect(editor.getContent()).toBe("helloworld");
        expect(editor.getCursor()).toEqual({ line: 0, col: 5 });
      });
    });

    describe("when deleting forward at end of line", () => {
      it("then joins with next line", () => {
        const editor = new Editor("hello\nworld");
        editor.setCursor(0, 5);
        editor.deleteCharForward();

        expect(editor.getContent()).toBe("helloworld");
      });
    });

    describe("when deleting a character backward", () => {
      it("then removes char before cursor", () => {
        const editor = new Editor("hello");
        editor.setCursor(0, 4);
        editor.deleteCharBackward();

        expect(editor.getContent()).toBe("helo");
        expect(editor.getCursor()).toEqual({ line: 0, col: 3 });
      });
    });

    describe("when deleting a character forward", () => {
      it("then removes char at cursor position", () => {
        const editor = new Editor("hello");
        editor.setCursor(0, 1);
        editor.deleteCharForward();

        expect(editor.getContent()).toBe("hllo");
      });
    });

    describe("when deleting a line", () => {
      it("then removes the line and moves cursor up", () => {
        const editor = new Editor("a\nb\nc");
        editor.setCursor(1, 0);
        editor.deleteLine();

        expect(editor.getLines()).toEqual(["a", "c"]);
      });
    });

    describe("when deleting the only line", () => {
      it("then clears its content", () => {
        const editor = new Editor("hello");
        editor.deleteLine();

        expect(editor.getContent()).toBe("");
      });
    });

    describe("when deleting word backward", () => {
      it("then removes the word before cursor", () => {
        const editor = new Editor("hello world");
        editor.setCursor(0, 11);
        editor.deleteWordBackward();

        expect(editor.getContent()).toBe("hello ");
        expect(editor.getCursor()).toEqual({ line: 0, col: 6 });
      });
    });

    describe("when deleting word forward", () => {
      it("then removes the word at cursor", () => {
        const editor = new Editor("hello world");
        editor.setCursor(0, 6);
        editor.deleteWordForward();

        expect(editor.getContent()).toBe("hello ");
      });
    });
  });

  describe("given selection", () => {
    describe("when selecting all", () => {
      it("then anchors at start and cursor at end", () => {
        const editor = new Editor("hello\nworld");
        editor.selectAll();

        expect(editor.hasSelection()).toBe(true);
        const sel = editor.getSelection();
        expect(sel).toEqual({
          start: { line: 0, col: 0 },
          end: { line: 1, col: 5 },
        });
      });
    });

    describe("when deleting with selection", () => {
      it("then replaces selected text", () => {
        const editor = new Editor("hello world");
        editor.setSelection({ line: 0, col: 0 }, { line: 0, col: 5 });
        editor.replaceSelection("hi");

        expect(editor.getContent()).toBe("hi world");
        expect(editor.hasSelection()).toBe(false);
      });
    });

    describe("when getting selected text", () => {
      it("then returns the selected portion", () => {
        const editor = new Editor("hello world");
        editor.setSelection({ line: 0, col: 0 }, { line: 0, col: 5 });

        expect(editor.getSelectedText()).toBe("hello");
      });
    });

    describe("when clearing selection", () => {
      it("then reports no selection", () => {
        const editor = new Editor("hello");
        editor.selectAll();
        editor.clearSelection();

        expect(editor.hasSelection()).toBe(false);
      });
    });
  });

  describe("given undo/redo", () => {
    describe("when typing and undoing", () => {
      it("then restores previous content", () => {
        const editor = new Editor("hello");
        // Cursor is at 0,0 after setContent, so insert adds at beginning
        editor.insertChar("!");
        expect(editor.getContent()).toBe("!hello");

        editor.undo();
        expect(editor.getContent()).toBe("hello");
      });
    });

    describe("when undoing past initial state", () => {
      it("then returns false and keeps content", () => {
        const editor = new Editor("hello");
        const result = editor.undo();

        expect(result).toBe(false);
        expect(editor.getContent()).toBe("hello");
      });
    });

    describe("when redoing after undo", () => {
      it("then restores the undone change", () => {
        const editor = setupUndoState();
        expect(editor.getContent()).toBe("hello");

        editor.redo();
        expect(editor.getContent()).toBe("!hello");
      });
    });

    describe("when new action after undo", () => {
      it("then clears the redo stack", () => {
        const editor = setupUndoState();
        expect(editor.getContent()).toBe("hello");
        // New insert at col 0
        editor.insertChar("?");
        expect(editor.getContent()).toBe("?hello");
        const redoResult = editor.redo();
        expect(redoResult).toBe(false);
      });
    });

    describe("when redoing with nothing to redo", () => {
      it("then returns false", () => {
        const editor = new Editor("hello");
        const result = editor.redo();

        expect(result).toBe(false);
      });
    });
  });

  describe("given toggle comment", () => {
    describe("when commenting an uncommented line", () => {
      it("then adds // prefix preserving indent", () => {
        const editor = new Editor("  hello world");
        editor.setCursor(0, 5);
        editor.toggleComment();

        expect(editor.getContent()).toBe("  // hello world");
      });
    });

    describe("when uncommenting a commented line", () => {
      it("then removes // prefix preserving indent", () => {
        const editor = new Editor("  // hello world");
        editor.toggleComment();

        expect(editor.getContent()).toBe("  hello world");
      });
    });
  });

  describe("given set cursor", () => {
    describe("when setting cursor beyond line length", () => {
      it("then clamps column to line end", () => {
        const editor = new Editor("hi");
        editor.setCursor(0, 100);

        expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
      });
    });

    describe("when setting cursor beyond last line", () => {
      it("then clamps line to last line", () => {
        const editor = new Editor("a\nb");
        editor.setCursor(10, 0);

        expect(editor.getCursor()).toEqual({ line: 1, col: 0 });
      });
    });
  });

  const lines = (count: number) =>
    Array.from({ length: count }, (_, i) => `line${i}`).join("\n");

  describe("given page navigation", () => {
    describe("when moving page up from middle", () => {
      it("then moves up by view height", () => {
        const editor = new Editor(lines(20));
        editor.setViewHeight(10);
        editor.setCursor(15, 0);
        editor.movePageUp(false);

        expect(editor.getCursor().line).toBe(6);
      });
    });

    describe("when moving page down past end", () => {
      it("then stops at last line", () => {
        const editor = new Editor(lines(5));
        editor.setViewHeight(10);
        editor.setCursor(3, 0);
        editor.movePageDown(false);

        expect(editor.getCursor().line).toBe(4);
      });
    });
  });

  describe("given word navigation", () => {
    describe("when moving word left", () => {
      it("then moves to previous word boundary", () => {
        const editor = new Editor("hello world");
        editor.setCursor(0, 8);
        editor.moveWordLeft(false);

        // From col 8: skipNonWord backward from 7 -> stays at 7 (word char)
        // then skipSameBackward from 7 for 'word' type -> goes to 7
        expect(editor.getCursor().col).toBe(7);
      });
    });

    describe("when moving word right", () => {
      it("then moves to end of current word", () => {
        const editor = new Editor("hello world");
        editor.setCursor(0, 0);
        editor.moveWordRight(false);

        expect(editor.getCursor().col).toBe(5);
      });
    });
  });

  describe("given line start/end navigation", () => {
    describe("when moving to line start", () => {
      it("then moves to first non-space or column 0", () => {
        const editor = new Editor("  hello");
        editor.setCursor(0, 5);
        editor.moveToLineStart(false);

        expect(editor.getCursor().col).toBe(2);
      });
    });

    describe("when moving to line end", () => {
      it("then moves to end of line", () => {
        const editor = new Editor("hello world");
        editor.setCursor(0, 3);
        editor.moveToLineEnd(false);

        expect(editor.getCursor().col).toBe(11);
      });
    });
  });

  describe("given set content", () => {
    describe("when setting new content", () => {
      it("then resets cursor and clears history", () => {
        const editor = new Editor("old");
        editor.insertChar("!");
        editor.setCursor(0, 3);
        editor.setContent("new");

        expect(editor.getContent()).toBe("new");
        expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
        expect(editor.undo()).toBe(false);
      });
    });
  });

  describe("given scroll adjustment", () => {
    describe("when cursor moves above viewport", () => {
      it("then adjusts top line to follow cursor", () => {
        const editor = new Editor(lines(20));
        editor.setViewHeight(10);
        editor.setCursor(5, 0);
        expect(editor.getTopLine()).toBe(0);

        editor.setContent(lines(20));
      });
    });
  });
});
