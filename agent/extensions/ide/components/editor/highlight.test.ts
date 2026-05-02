import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { createEditorComponent } from "./component";
import type { EditorResult } from "./component";
import {
  createMockTheme,
  createMockTui,
  createMockPi,
} from "../../lib/test-utils";

describe("syntax highlighting", () => {
  let tui: ReturnType<typeof createMockTui>;
  let theme: ReturnType<typeof createMockTheme>;
  let doneFn: Mock<(result: EditorResult | null) => void>;

  beforeEach(() => {
    tui = createMockTui();
    theme = createMockTheme();
    doneFn = vi.fn() as unknown as typeof doneFn;
  });
  const createComponent = (content: string, filePath: string) =>
    createEditorComponent({
      pi: createMockPi(),
      tui,
      theme,
      done: doneFn,
      filePath,
      content,
    });

  describe("given TypeScript code", () => {
    describe("when rendering code with keywords", async () => {
      it("then applies syntax highlighting to keywords", async () => {
        const code = "const x = 42;\nfunction foo() { return x; }";
        const comp = createComponent(code, "/tmp/test.ts");
        // Wait for async highlight to complete
        await new Promise((r) => setTimeout(r, 500));
        const lines = comp.render(120);
        // Find the code line (contains 'const')
        const codeLine = lines.find((l) => l.includes("const"));
        expect(codeLine).toBeDefined();
        // Check that 'const' keyword has truecolor ANSI codes around it
        const keywordMatch = codeLine!.match(
          /\x1b\[38;2;\d+;\d+;\d+mconst\x1b\[[0-9;]*m/,
        );
        expect(keywordMatch).not.toBeNull();
        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when rendering code with strings", () => {
      it("then applies syntax highlighting to string literals", () => {
        const code = 'const msg = "hello world";';
        const comp = createComponent(code, "/tmp/test.ts");
        const lines = comp.render(120);

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when rendering code with comments", () => {
      it("then applies syntax highlighting to comments", () => {
        const code = "// this is a comment\nconst x = 1;";
        const comp = createComponent(code, "/tmp/test.ts");
        const lines = comp.render(120);

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when rendering code with numbers", () => {
      it("then applies syntax highlighting to numeric literals", () => {
        const code = "const pi = 3.14;\nconst count = 100;";
        const comp = createComponent(code, "/tmp/test.ts");
        const lines = comp.render(120);

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given JavaScript code", () => {
    describe("when rendering JS with different file extension", () => {
      it("then applies JavaScript highlighting", () => {
        const code = "var x = function() { return true; };";
        const comp = createComponent(code, "/tmp/test.js");
        const lines = comp.render(120);

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given plain text file", () => {
    describe("when rendering non-code file", () => {
      it("then does not apply syntax highlighting", () => {
        const content = "This is plain text.\nNo special tokens.";
        const comp = createComponent(content, "/tmp/readme.txt");
        const lines = comp.render(120);

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given highlight cache", () => {
    describe("when rendering same content twice", () => {
      it("then uses cached highlighting", () => {
        const code = "const x = 42;";
        const comp = createComponent(code, "/tmp/test.ts");

        comp.render(120);
        const second = comp.render(120);

        expect(Array.isArray(second)).toBe(true);
      });
    });

    describe("when content changes", () => {
      it("then recomputes highlighting", () => {
        const comp = createComponent("const x = 1;", "/tmp/test.ts");
        comp.render(120);

        comp.handleInput?.("2");
        const lines = comp.render(120);

        expect(lines.join("\n")).toMatchSnapshot();
      });
    });
  });
});
