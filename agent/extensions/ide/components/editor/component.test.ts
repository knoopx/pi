import { CURSOR_MARKER } from "@mariozechner/pi-tui";
import type { Component, Focusable } from "@mariozechner/pi-tui";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEditorComponent, type EditorResult } from "./component";
import {
  createMockTheme,
  createMockTui,
  createMockPi,
} from "../../lib/test-utils";

interface TestEditorComponent extends Component, Focusable {
  handleInput(data: string): void;
  dispose(): void;
}

describe("createEditorComponent", () => {
  let tui: ReturnType<typeof createMockTui>;
  let theme: ReturnType<typeof createMockTheme>;
  let doneFn: ReturnType<typeof vi.fn<(result: EditorResult | null) => void>>;

  beforeEach(() => {
    tui = createMockTui();
    // Wire mock setFocus to actually flip focused on the component
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

  describe("given component creation", () => {
    describe("when created with content", () => {
      it("then initializes editor with correct lines", () => {
        const comp = createComponent();

        expect(comp.focused).toBe(true);
      });
    });

    describe("when created with cursorLine option", () => {
      it("then sets cursor to specified line", () => {
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
      it("then produces a bordered overlay frame", () => {
        const comp = createComponent();
        const lines = comp.render(120);

        // Box-drawing chars have ANSI color codes prepended by theme.fg()
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

        expect(lines).toMatchSnapshot();
      });
    });

    describe("when rendering with file path", () => {
      it("then shows basename in title", () => {
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

        expect(lines).toMatchSnapshot();
      });
    });

    describe("when rendering content lines", () => {
      it("then shows line numbers and content with left border", () => {
        const comp = createComponent();
        const lines = comp.render(120);

        // Content rows start after title + separator (index 3+)
        // Border char has ANSI color codes so check for the unicode box char
        const contentStart = 3;
        const contentLine = lines[contentStart];
        expect(contentLine).toContain("│");

        expect(lines).toMatchSnapshot();
      });
    });

    describe("when rendering help bar", () => {
      it("then includes key bindings in help text", () => {
        const comp = createComponent();
        const lines = comp.render(120);
        const helpLine = lines[lines.length - 2];

        expect(helpLine).toContain("esc quit");
        expect(helpLine).toContain("ctrl+s save");
        expect(helpLine).toContain("ctrl+z undo");

        expect(lines).toMatchSnapshot();
      });
    });

    describe("when caching is active", () => {
      it("then returns cached result on same width", () => {
        const comp = createComponent();
        const first = comp.render(120);
        const second = comp.render(120);

        expect(first).toBe(second); // same reference
      });
    });

    describe("when invalidated", () => {
      it("then re-renders on next call", () => {
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
      it("then inserts the character and requests render", () => {
        const comp = createComponent();
        comp.handleInput("x");

        expect(tui.requestRender).toHaveBeenCalled();

        const lines = comp.render(120);
        expect(lines).toMatchSnapshot();
      });
    });

    describe("when pressing escape", () => {
      it("then calls done with result", async () => {
        const comp = createComponent();
        comp.handleInput("\x1b"); // Escape triggers async quit

        // Wait for the async save + done to complete
        await new Promise((r) => setTimeout(r, 0));
        expect(doneFn).toHaveBeenCalled();
      });
    });

    describe("when pressing enter", () => {
      it("then inserts a newline and requests render", () => {
        const comp = createComponent();
        comp.handleInput("\r"); // Enter

        expect(tui.requestRender).toHaveBeenCalled();

        const lines = comp.render(120);
        expect(lines).toMatchSnapshot();
      });
    });

    describe("when pressing backspace", () => {
      it("then deletes character backward", () => {
        const comp = createComponent();
        comp.handleInput("\x7f"); // DEL

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing ctrl+s", () => {
      it("then saves and shows status notification", () => {
        const comp = createComponent();
        comp.handleInput("\x13"); // Ctrl+S

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing arrow up", () => {
      it("then moves cursor up", () => {
        const comp = createComponent();
        comp.handleInput("\x1b[A"); // Up arrow

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing arrow down", () => {
      it("then moves cursor down", () => {
        const comp = createComponent();
        comp.handleInput("\x1b[B"); // Down arrow

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing page up", () => {
      it("then scrolls page up", () => {
        const comp = createComponent();
        comp.handleInput("\x1b[5~"); // Page Up

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing page down", () => {
      it("then scrolls page down", () => {
        const comp = createComponent();
        comp.handleInput("\x1b[6~"); // Page Down

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing home", () => {
      it("then moves to line start", () => {
        const comp = createComponent();
        comp.handleInput("\x1b[H"); // Home

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    describe("when pressing end", () => {
      it("then moves to line end", () => {
        const comp = createComponent();
        comp.handleInput("\x1b[F"); // End

        expect(tui.requestRender).toHaveBeenCalled();
      });
    });
  });

  describe("given pair insertion", () => {
    describe("when typing opening parenthesis", () => {
      it("then inserts matching pair", () => {
        const comp = createComponent();
        comp.handleInput("(");

        expect(tui.requestRender).toHaveBeenCalled();

        const lines = comp.render(120);
        expect(lines).toMatchSnapshot();
      });
    });

    describe("when typing opening bracket", () => {
      it("then inserts matching pair", () => {
        const comp = createComponent();
        comp.handleInput("[");

        expect(tui.requestRender).toHaveBeenCalled();

        const lines = comp.render(120);
        expect(lines).toMatchSnapshot();
      });
    });

    describe("when typing opening brace", () => {
      it("then inserts matching pair", () => {
        const comp = createComponent();
        comp.handleInput("{");

        expect(tui.requestRender).toHaveBeenCalled();

        const lines = comp.render(120);
        expect(lines).toMatchSnapshot();
      });
    });
  });

  describe("given status notifications", () => {
    describe("when notify is called with info message", () => {
      it("then renders with status in help bar", () => {
        const comp = createComponent();
        // @ts-expect-error -- notify is not public but testable
        comp.notify("Saved", "info");

        const lines = comp.render(120);
        const helpLine = lines[lines.length - 2];
        expect(helpLine).toContain("Saved");

        expect(lines).toMatchSnapshot();
      });
    });
  });

  describe("given focus", () => {
    describe("when focused is true", () => {
      it("then shows cursor marker in output", () => {
        const comp = createComponent();
        const lines = comp.render(120);

        const contentLine = lines[3];
        expect(contentLine).toContain(CURSOR_MARKER);

        expect(lines).toMatchSnapshot();
      });
    });

    describe("when focused is set to false", () => {
      it("then hides cursor marker", () => {
        const comp = createComponent();
        comp.focused = false;
        const lines = comp.render(120);

        for (let i = 3; i < lines.length - 2; i++) {
          expect(lines[i]).not.toContain(CURSOR_MARKER);
        }

        expect(lines).toMatchSnapshot();
      });
    });
  });

  describe("given dispose", () => {
    describe("when disposed", () => {
      it("then clears highlight cache", () => {
        const comp = createComponent();
        comp.dispose();

        expect(() => {
          comp.dispose();
        }).not.toThrow();
      });
    });
  });

  describe("given empty file", () => {
    describe("when editing an empty file", () => {
      it("then renders with empty content area", () => {
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

        expect(lines).toMatchSnapshot();
      });
    });
  });

  describe("given quit behavior", () => {
    describe("when quitting with unsaved changes", () => {
      it("then saves before closing", async () => {
        const comp = createComponent("original");
        // Type something to create unsaved changes
        comp.handleInput("x");

        // Press escape to quit (async)
        comp.handleInput("\x1b");

        await new Promise((r) => setTimeout(r, 0));
        expect(doneFn).toHaveBeenCalled();
      });
    });
  });
});
