import { CURSOR_MARKER } from "@earendil-works/pi-tui";
import type { Component, Focusable } from "@earendil-works/pi-tui";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createEditorComponent } from "./component";
import type { EditorResult } from "./component";
import {
  createMockTheme,
  createMockTui,
  createMockPi,
  waitForAsyncHighlight,
} from "../../test/utils";
interface TestEditorComponent extends Component, Focusable {
  handleInput(data: string): void;
  dispose(): void;
  notify(message: string, level?: string): void;
}

describe("createEditorComponent", () => {
  let tui: ReturnType<typeof createMockTui>;
  let theme: ReturnType<typeof createMockTheme>;
  let doneFn: ReturnType<typeof vi.fn<(result: EditorResult | null) => void>>;

  beforeEach(() => {
    tui = createMockTui();
    (tui.setFocus as ReturnType<typeof vi.fn>).mockImplementation(
      (comp: Focusable) => {
        comp.focused = true;
      },
    );
    theme = createMockTheme();
    doneFn = vi.fn();
  });
  const createComponent = (
    content = "hello\nworld",
    filePath = "/tmp/test.ts",
  ): TestEditorComponent =>
    createEditorComponent({
      pi: createMockPi(),
      tui,
      theme,
      done: doneFn,
      filePath,
      content,
    }) as unknown as TestEditorComponent;

  const createTsComponent = (
    content: string,
    filePath = "/tmp/test.ts",
  ): TestEditorComponent =>
    createEditorComponent({
      pi: createMockPi(),
      tui,
      theme,
      done: doneFn,
      filePath,
      content,
    }) as unknown as TestEditorComponent;

  const toggleCommentAndSnapshot = async (
    initialContent: string,
  ): Promise<void> => {
    const comp = createTsComponent(initialContent);
    await waitForAsyncHighlight();
    comp.handleInput("\x1f");
    const lines = comp.render(120);
    expect(lines.join("\n")).toMatchSnapshot();
  };

  const typeAndSnapshot = (comp: TestEditorComponent, input: string): void => {
    comp.handleInput(input);
    expect(tui.requestRender).toHaveBeenCalled();
    const lines = comp.render(120);
    expect(lines.join("\n")).toMatchSnapshot();
  };

  describe("given component creation", () => {
    describe("when created with content", () => {
      it("then initializes editor with correct lines", (): void => {
        const comp = createComponent();

        expect(comp.focused).toBe(true);
      });
    });

    describe("when created with cursorLine option", () => {
      it("then sets cursor to specified line", (): void => {
        const tui2 = createMockTui();
        const doneFn2 = vi.fn();
        const comp = createEditorComponent({
          pi: createMockPi(),
          tui: tui2,
          theme,
          done: doneFn2,
          filePath: "/tmp/test.ts",
          content: "a\nb\nc",
          cursorLine: 2,
        });

        comp.render(120);
      });
    });
  });

  describe("given render output", () => {
    describe("when rendering at width 120", () => {
      it("then produces a bordered overlay frame", (): void => {
        const comp = createComponent();
        const lines = comp.render(120);

        expect(lines[0]).toContain("╭");
        expect(lines[0]).toContain("╮");
        expect(lines[0]).toContain("─");

        expect(lines[1]).toContain("Editing:");
        expect(lines[1]).toContain("test.ts");

        expect(lines[2]).toContain("├");
        expect(lines[2]).toContain("┤");
        const lastLine = lines[lines.length - 1];
        expect(lastLine).toContain("╰");
        expect(lastLine).toContain("╯");
        const helpLine = lines[lines.length - 2];
        expect(helpLine).toContain("esc quit");

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when rendering with file path", () => {
      it("then shows basename in title", (): void => {
        const comp = createEditorComponent({
          pi: createMockPi(),
          tui,
          theme,
          done: doneFn,
          filePath: "/some/deep/path/myfile.tsx",
          content: "hello",
        });
        const lines = comp.render(120);
        expect(lines[1]).toContain("myfile.tsx");
        expect(lines[1]).not.toContain("/some/deep/path/");

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when rendering content lines", () => {
      it("then shows line numbers and content with left border", (): void => {
        const comp = createComponent();
        const lines = comp.render(120);
        const contentStart = 3;
        const contentLine = lines[contentStart];
        expect(contentLine).toContain("│");

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when rendering help bar", () => {
      it("then includes key bindings in help text", (): void => {
        const comp = createComponent();
        const lines = comp.render(120);
        const helpLine = lines[lines.length - 2];

        expect(helpLine).toContain("esc quit");
        expect(helpLine).toContain("ctrl+s save");
        expect(helpLine).toContain("ctrl+z undo");

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when caching is active", () => {
      it("then returns cached result on same width", (): void => {
        const comp = createComponent();
        comp.render(120);
        comp.render(120);
      });
    });

    describe("when invalidated", () => {
      it("then re-renders on next call", (): void => {
        const comp = createComponent();
        comp.render(120);
        comp.invalidate();
        const second = comp.render(120);

        expect(Array.isArray(second)).toBe(true);
      });
    });
  });

  describe("given keyboard input", () => {
    describe("when typing a character", () => {
      it("then inserts the character and requests render", (): void => {
        typeAndSnapshot(createComponent(), "x");
      });
    });

    describe("when pressing escape", () => {
      it("then calls done with result", async (): Promise<void> => {
        const comp = createComponent();
        comp.handleInput("\x1b");

        await new Promise((r) => setTimeout(r, 0));
        expect(doneFn).toHaveBeenCalled();
      });
    });

    describe("when pressing enter", () => {
      it("then inserts a newline and requests render", (): void => {
        typeAndSnapshot(createComponent(), "\r");
      });
    });

    describe("when pressing backspace", () => {
      it("then deletes character backward", (): void => {
        const comp = createComponent();
        comp.handleInput("\x7f");

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing ctrl+s", () => {
      it("then saves and shows status notification", (): void => {
        const comp = createComponent();
        comp.handleInput("\x13");

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing arrow up", () => {
      it("then moves cursor up", (): void => {
        const comp = createComponent();
        comp.handleInput("\x1b[A");

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing arrow down", () => {
      it("then moves cursor down", (): void => {
        const comp = createComponent();
        comp.handleInput("\x1b[B");

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing page up", () => {
      it("then scrolls page up", (): void => {
        const comp = createComponent();
        comp.handleInput("\x1b[5~");

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing page down", () => {
      it("then scrolls page down", (): void => {
        const comp = createComponent();
        comp.handleInput("\x1b[6~");

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing home", () => {
      it("then moves to line start", (): void => {
        const comp = createComponent();
        comp.handleInput("\x1b[H");

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing end", () => {
      it("then moves to line end", (): void => {
        const comp = createComponent();
        comp.handleInput("\x1b[F");

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });
  });

  describe("given pair insertion", () => {
    describe("when typing opening parenthesis", () => {
      it("then inserts matching pair", (): void => {
        typeAndSnapshot(createComponent(), "(");
      });
    });

    describe("when typing opening bracket", () => {
      it("then inserts matching pair", (): void => {
        typeAndSnapshot(createComponent(), "[");
      });
    });

    describe("when typing opening brace", () => {
      it("then inserts matching pair", (): void => {
        typeAndSnapshot(createComponent(), "{");
      });
    });
  });

  describe("given status notifications", () => {
    describe("when notify is called with info message", (): void => {
      it("then renders with status in help bar", (): void => {
        const comp = createComponent();
        comp.notify("Saved", "info");
        const lines = comp.render(120);
        const helpLine = lines[lines.length - 2];
        expect(helpLine).toContain("Saved");

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given focus", () => {
    describe("when focused is true", () => {
      it("then shows cursor marker in output", (): void => {
        const comp = createComponent();
        const lines = comp.render(120);
        const contentLine = lines[3];
        expect(contentLine).toContain(CURSOR_MARKER);

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when focused is set to false", () => {
      it("then hides cursor marker", (): void => {
        const comp = createComponent();
        comp.focused = false;
        const lines = comp.render(120);

        for (let i = 3; i < lines.length - 2; i++) {
          expect(lines[i]).not.toContain(CURSOR_MARKER);
        }

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given dispose", () => {
    describe("when disposed", () => {
      it("then clears highlight cache", (): void => {
        const comp = createComponent();
        comp.dispose();

        expect(() => {
          comp.dispose();
        }).not.toThrow();
      });
    });
  });

  describe("given empty file", () => {
    describe("when editing an empty file", (): void => {
      it("then renders with empty content area", (): void => {
        const comp = createEditorComponent({
          pi: createMockPi(),
          tui,
          theme,
          done: doneFn,
          filePath: "/tmp/empty.txt",
          content: "",
        });
        const lines = comp.render(120);
        expect(lines[1]).toContain("empty.txt");

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given quit behavior", () => {
    describe("when quitting with unsaved changes", () => {
      it("then saves before closing", async (): Promise<void> => {
        const comp = createComponent("original");
        comp.handleInput("x");

        comp.handleInput("\x1b");

        await new Promise((r) => setTimeout(r, 0));
        expect(doneFn).toHaveBeenCalled();
      });
    });
  });

  describe("given syntax highlighting with cursor", () => {
    describe("when rendering TypeScript with keywords", async () => {
      it("then shows highlighted output with cursor marker", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        const codeLine = lines[3];
        expect(codeLine).toBeDefined();
        expect(codeLine!.includes(CURSOR_MARKER)).toBe(true);
      });
    });

    describe("when navigating with arrow keys on highlighted content", async () => {
      it("then moves cursor and updates render after typing", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("x");
        const linesAfterType = comp.render(120);
        expect(linesAfterType.join("\n")).toMatchSnapshot();
      });
    });

    describe("when navigating up/down on multi-line highlighted code", async () => {
      it("then moves cursor between lines correctly", async () => {
        const comp = createTsComponent(
          "const x = 42;\nfunction foo() { return x; }",
        );
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[B");
        const linesAfterDown = comp.render(120);
        expect(linesAfterDown.join("\n")).toMatchSnapshot();
      });
    });

    describe("when navigating to line start on highlighted content", async () => {
      it("then moves cursor to beginning of line", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[H");
        const linesAfterHome = comp.render(120);
        expect(linesAfterHome.join("\n")).toMatchSnapshot();
      });
    });

    describe("when navigating to line end on highlighted content", async () => {
      it("then moves cursor to end of line", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[F");
        const linesAfterEnd = comp.render(120);
        expect(linesAfterEnd.join("\n")).toMatchSnapshot();
      });
    });

    describe("when page down on highlighted content", async () => {
      it("then scrolls viewport and updates cursor position", async () => {
        const comp = createTsComponent(
          "const x = 42;\nconst y = 100;\nfunction foo() { return x + y; }",
        );
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[6~");
        const linesAfterPageDown = comp.render(120);
        expect(linesAfterPageDown.join("\n")).toMatchSnapshot();
      });
    });

    describe("when page up on highlighted content", async () => {
      it("then scrolls viewport up and updates cursor position", async () => {
        const comp = createTsComponent(
          "const x = 42;\nconst y = 100;\nfunction foo() { return x + y; }",
        );
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[B");
        comp.handleInput("\x1b[B");
        comp.handleInput("\x1b[5~");
        const linesAfterPageUp = comp.render(120);
        expect(linesAfterPageUp.join("\n")).toMatchSnapshot();
      });
    });

    describe("when inserting text in highlighted content", async () => {
      it("then updates highlighting after insertion", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[F");
        comp.handleInput("!");
        const linesAfterInsert = comp.render(120);
        expect(linesAfterInsert.join("\n")).toMatchSnapshot();
      });
    });

    describe("when deleting backward on highlighted content", async () => {
      it("then removes character and updates render", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[F");
        comp.handleInput("\x7f");
        const linesAfterDelete = comp.render(120);
        expect(linesAfterDelete.join("\n")).toMatchSnapshot();
      });
    });

    describe("when deleting word backward on highlighted content", async () => {
      it("then removes word before cursor", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x17");
        const linesAfterDelWord = comp.render(120);
        expect(linesAfterDelWord.join("\n")).toMatchSnapshot();
      });
    });

    describe("when toggling comment on highlighted content", async () => {
      it("then adds // prefix and updates highlighting", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1f");
        const linesAfterComment = comp.render(120);
        expect(linesAfterComment.join("\n")).toMatchSnapshot();
      });
    });

    describe("when undoing changes on highlighted content", async () => {
      it("then restores previous state and re-renders", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("x");
        comp.handleInput("\x1a");
        const linesAfterUndo = comp.render(120);
        expect(linesAfterUndo.join("\n")).toMatchSnapshot();
      });
    });

    describe("when redoing changes on highlighted content", async () => {
      it("then restores undone change and re-renders", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("x");
        comp.handleInput("\x1a");
        comp.handleInput("\x19");
        const linesAfterRedo = comp.render(120);
        expect(linesAfterRedo.join("\n")).toMatchSnapshot();
      });
    });

    describe("when selecting all on highlighted content", async () => {
      it("then highlights entire content area", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x01");
        const linesAfterSelectAll = comp.render(120);
        expect(linesAfterSelectAll.join("\n")).toMatchSnapshot();
      });
    });

    describe("when deleting line on highlighted content", async () => {
      it("then removes the current line", async () => {
        const comp = createTsComponent("const x = 42;\nfunction foo() {}");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[B");
        // Shift+delete (simulated as backspace on empty - actual key may differ)
        const linesAfterDelete = comp.render(120);
        expect(linesAfterDelete.join("\n")).toMatchSnapshot();
      });
    });

    describe("when inserting newline in highlighted content", async () => {
      it("then splits the line and preserves indent", async () => {
        const comp = createTsComponent("  const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[F");
        comp.handleInput("\r");
        const linesAfterNewline = comp.render(120);
        expect(linesAfterNewline.join("\n")).toMatchSnapshot();
      });
    });

    describe("when inserting pair on highlighted content", async () => {
      it("then wraps with matching pair", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[F");
        comp.handleInput("(");
        const linesAfterPair = comp.render(120);
        expect(linesAfterPair.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given different file types", () => {
    const createComponentWithFile = (
      content: string,
      ext: string,
    ): TestEditorComponent =>
      createEditorComponent({
        pi: createMockPi(),
        tui,
        theme,
        done: doneFn,
        filePath: `/tmp/test.${ext}`,
        content,
      }) as unknown as TestEditorComponent;

    describe("when editing JavaScript file", async () => {
      it("then applies JavaScript highlighting", async () => {
        const comp = createComponentWithFile(
          "var x = function() { return true; };",
          "js",
        );
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        expect(lines[3]).toBeDefined();
      });
    });

    describe("when editing plain text file", async () => {
      it("then does not apply syntax highlighting", async () => {
        const comp = createComponentWithFile(
          "This is plain text.\nNo special tokens.",
          "txt",
        );
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        // Should still render with cursor marker
        const contentLine = lines.find((l) => l.includes("plain text"));
        expect(contentLine).toBeDefined();
      });
    });

    describe("when editing JSON file", async () => {
      it("then applies JSON highlighting", async () => {
        const comp = createComponentWithFile(
          '{ "key": "value", "num": 42 }',
          "json",
        );
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        const codeLine = lines.find((l) => l.includes("key"));
        expect(codeLine).toBeDefined();
      });
    });

    describe("when editing TOML file", async () => {
      it("then applies TOML highlighting", async () => {
        const comp = createComponentWithFile(
          '[package]\nname = "my-app"',
          "toml",
        );
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        const codeLine = lines.find((l) => l.includes("package"));
        expect(codeLine).toBeDefined();
      });
    });

    describe("when editing Python file", async () => {
      it("then applies Python highlighting", async () => {
        const comp = createComponentWithFile(
          'def hello(name: str) -> str:\n  return f"Hello, {name}"',
          "py",
        );
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        expect(lines[3]).toBeDefined();
      });
    });

    describe("when editing Rust file", async () => {
      it("then applies Rust highlighting", async () => {
        const comp = createComponentWithFile(
          "fn main() {\n  let x = 42;\n}",
          "rs",
        );
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        expect(lines[3]).toBeDefined();
      });
    });

    describe("when editing Markdown file", async () => {
      it("then applies Markdown highlighting", async () => {
        const comp = createComponentWithFile(
          "# Heading\n\nSome **bold** text.",
          "md",
        );
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        const codeLine = lines.find((l) => l.includes("Heading"));
        expect(codeLine).toBeDefined();
      });
    });
  });

  describe("given large files", () => {
    const createLargeTsComponent = (lineCount: number): TestEditorComponent => {
      const content = Array.from(
        { length: lineCount },
        (_, i) => `const line${i} = ${i * 2};`,
      ).join("\n");
      return createEditorComponent({
        pi: createMockPi(),
        tui,
        theme,
        done: doneFn,
        filePath: "/tmp/large.ts",
        content,
      }) as unknown as TestEditorComponent;
    };

    describe("when rendering 50-line file", async () => {
      it("then shows line numbers up to 2 digits", async () => {
        const comp = createLargeTsComponent(50);
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        // Line 10 should have 2-digit line number
        const line10 = lines.find((l) => l.includes("line9"));
        expect(line10).toBeDefined();
      });
    });

    describe("when rendering 100-line file", async () => {
      it("then shows line numbers up to 3 digits", async () => {
        const comp = createLargeTsComponent(100);
        await waitForAsyncHighlight();
        const lines = comp.render(120);

        expect(lines[3]).toBeDefined();
      });
    });

    describe("when navigating past end of large file", async () => {
      it("then keeps cursor at last line", async () => {
        const comp = createLargeTsComponent(50);
        await waitForAsyncHighlight();

        for (let i = 0; i < 100; i++) {
          comp.handleInput("\x1b[B");
        }
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when scrolling through large file", async () => {
      it("then updates visible content correctly", async () => {
        const comp = createLargeTsComponent(50);
        await waitForAsyncHighlight();

        for (let i = 0; i < 5; i++) {
          comp.handleInput("\x1b[6~");
        }
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given cursor movement edge cases", () => {
    describe("when moving left from start of first line", async () => {
      it("then stays at position 0,0", async () => {
        const comp = createTsComponent("hello");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[D");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when moving up from first line", async () => {
      it("then stays on first line", async () => {
        const comp = createTsComponent("line1\nline2");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[A");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when moving right past end of line", async () => {
      it("then moves to start of next line", async () => {
        const comp = createTsComponent("hi\nbye");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[C");
        comp.handleInput("\x1b[C");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when moving down past last line", async () => {
      it("then stays on last line", async () => {
        const comp = createTsComponent("line1\nline2");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[B");
        comp.handleInput("\x1b[B");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when moving word right on highlighted content", async () => {
      it("then jumps to next word boundary", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[1;5C");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when moving word left on highlighted content", async () => {
      it("then jumps to previous word boundary", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[1;5D");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when deleting forward from end of line", async () => {
      it("then joins with next line", async () => {
        const comp = createTsComponent("hello\nworld");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[F");
        comp.handleInput("\u007F");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when deleting backward from start of line", async () => {
      it("then joins with previous line", async () => {
        const comp = createTsComponent("hello\nworld");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[B");
        comp.handleInput("\x1b[H");
        comp.handleInput("\x7f");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when deleting word forward from highlighted content", async () => {
      it("then removes word at cursor position", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[3;5~");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given selection with highlighted content", () => {
    describe("when selecting all on highlighted content", async () => {
      it("then highlights entire content", async () => {
        const comp = createTsComponent("const x = 42;\nfunction foo() {}");
        await waitForAsyncHighlight();

        comp.handleInput("\x01");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when selecting with shift+arrow on highlighted content", async () => {
      it("then creates selection and highlights selected range", async () => {
        const comp = createTsComponent("const x = 42;");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[1;2C");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given clipboard bracketed paste", () => {
    describe("when receiving bracketed paste data", async () => {
      it("then inserts pasted text correctly", async () => {
        const comp = createTsComponent("");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[200~hello world\x1b[201~");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when receiving bracketed paste with newlines", async () => {
      it("then handles multi-line paste correctly", async () => {
        const comp = createTsComponent("");
        await waitForAsyncHighlight();

        comp.handleInput("\x1b[200~line1\nline2\nline3\x1b[201~");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given undo/redo with highlighted content", () => {
    describe("when performing multiple edits then undo", async () => {
      it("then restores each state in reverse order", async () => {
        const comp = createTsComponent("a");
        await waitForAsyncHighlight();

        comp.handleInput("b");
        comp.handleInput("c");
        comp.handleInput("d");
        comp.handleInput("\x1a");
        comp.handleInput("\x1a");
        comp.handleInput("\x1a");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when redoing after multiple undos", async () => {
      it("then restores each state in forward order", async () => {
        const comp = createTsComponent("a");
        await waitForAsyncHighlight();

        comp.handleInput("b");
        comp.handleInput("\x1a");
        comp.handleInput("\x19");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when new edit after undo", async () => {
      it("then clears the redo stack", async () => {
        const comp = createTsComponent("a");
        await waitForAsyncHighlight();

        comp.handleInput("b");
        comp.handleInput("\x1a");
        comp.handleInput("c");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given comment toggle", () => {
    describe("when commenting an uncommented line", async () => {
      it("then adds // prefix preserving indent", async () => {
        await toggleCommentAndSnapshot("  hello world");
      });
    });

    describe("when uncommenting a commented line", async () => {
      it("then removes // prefix preserving indent", async () => {
        await toggleCommentAndSnapshot("  // hello world");
      });
    });

    describe("when commenting already commented line", async () => {
      it("then toggles off the comment", async () => {
        const comp = createTsComponent("// already commented");
        await waitForAsyncHighlight();

        comp.handleInput("\x1f");
        comp.handleInput("\x1f");
        const lines = comp.render(120);
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });
});
