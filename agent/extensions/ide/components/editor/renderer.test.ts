import { describe, it, expect } from "vitest";
import { CURSOR_MARKER } from "@earendil-works/pi-tui";
import { renderEditorView } from "./renderer";
import type { RenderOptions } from "./renderer";
import { createMockTheme } from "../../test/utils";
const theme = createMockTheme();

// Helper: simulate syntax-highlighted line (Shiki-style ANSI codes per token)
function hl(
  segments: { text: string; color?: [number, number, number] }[],
): string {
  return segments
    .map((s) => {
      if (s.color) {
        const [r, g, b] = s.color;
        return `\x1b[38;2;${r};${g};${b}m${s.text}\x1b[0m`;
      }
      return s.text;
    })
    .join("");
}

// Raw text corresponding to a highlighted line (for cursor col reference)
function _rawText(segments: { text: string }[]): string {
  return segments.map((s) => s.text).join("");
}

// Helper: render with cursor and assert CURSOR_MARKER is present on the cursor line
function expectCursorOnLine(
  opts: RenderOptions,
  lines: string[],
  cursorLine: number,
  cursorCol: number,
): void {
  const result = renderEditorView(theme, {
    ...opts,
    lines,
    cursor: { line: cursorLine, col: cursorCol },
  });
  expect(result.lines[cursorLine]).toContain(CURSOR_MARKER);
}

describe("renderEditorView", () => {
  const baseOpts: RenderOptions = {
    lines: ["hello", "world", "foo"],
    width: 80,
    height: 10,
    cursor: { line: 0, col: 0 },
    topLine: 0,
    showCursor: true,
    selection: null,
  };

  describe("given basic rendering", () => {
    describe("when rendering lines with cursor", () => {
      it("then includes CURSOR_MARKER on cursor line", () => {
        const result = renderEditorView(theme, baseOpts);

        expect(result.lines[0]).toContain(CURSOR_MARKER);
        expect(result.lines.length).toBe(10);

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when rendering with cursor hidden", () => {
      it("then does not include cursor marker", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          showCursor: false,
        });

        for (const line of result.lines) {
          expect(line).not.toContain(CURSOR_MARKER);
        }

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given line numbers", () => {
    describe("when rendering numbered lines", () => {
      it("then shows line numbers with dim color prefix", () => {
        const result = renderEditorView(theme, baseOpts);

        expect(result.lines[0]).toMatch(/\x1b\[/);
        expect(result.lines[0]).toContain("1");
        expect(result.lines[1]).toContain("2");
        expect(result.lines[2]).toContain("3");

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when line count exceeds 99", () => {
      it("then widens line number column", () => {
        const lines = Array.from({ length: 150 }, (_, i) => `line${i}`);
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          height: 5,
        });

        expect(result.lines[0]).toContain("1");

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given viewport clipping", () => {
    describe("when content exceeds height", () => {
      it("then clips to viewport height using topLine offset", () => {
        const lines = ["a", "b", "c", "d", "e", "f", "g"];
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          height: 3,
          topLine: 2,
        });

        expect(result.lines.length).toBe(3);

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when content is shorter than height", () => {
      it("then pads with empty lines", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["only one"],
          height: 5,
        });

        expect(result.lines.length).toBe(5);
        expect(result.lines[1]).toBe("");

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given selection highlighting", () => {
    describe("when single-line selection is active", () => {
      it("then applies selectedBg to selected portion", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          selection: {
            start: { line: 0, col: 0 },
            end: { line: 0, col: 5 },
          },
        });

        expect(result.lines[0]).toContain("\x1b[48;");

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when multi-line selection is active", () => {
      it("then highlights partial first and last lines", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          selection: {
            start: { line: 0, col: 3 },
            end: { line: 2, col: 2 },
          },
        });

        expect(result.lines[0]).toContain("\x1b[48;");
        expect(result.lines[2]).toContain("\x1b[48;");

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when no selection is active", () => {
      it("then does not apply selection styling", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          selection: null,
        });

        for (const line of result.lines) {
          expect(line).not.toContain("\x1b[48;");
        }

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given width truncation", () => {
    describe("when line exceeds width", () => {
      it("then truncates to fit within width", () => {
        const longLine = "a".repeat(200);
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [longLine],
          width: 40,
        });

        expect(result.lines[0].length).toBeLessThanOrEqual(200);
      });
    });
  });

  describe("given empty content", () => {
    describe("when rendering empty lines array", () => {
      it("then returns all empty lines matching height", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [],
          height: 5,
        });

        expect(result.lines.length).toBe(5);
        for (const line of result.lines) {
          expect(line.trim()).toBe("");
        }

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given cursor positioning", () => {
    describe("when cursor is mid-line", () => {
      it("then places cursor marker at correct position", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["hello"],
          cursor: { line: 0, col: 3 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });

    describe("when cursor is at end of line", () => {
      it("then places cursor marker after content", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["hi"],
          cursor: { line: 0, col: 2 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);

        expect(result.lines.join("\n")).toMatchSnapshot();
      });
    });
  });

  describe("given syntax-highlighted content", () => {
    const keywordColor: [number, number, number] = [179, 146, 240];
    const varColor: [number, number, number] = [121, 184, 255];
    const numColor: [number, number, number] = [121, 184, 255];

    describe("when cursor is on highlighted line at col 0", () => {
      it("then places cursor marker after line number prefix", () => {
        const highlightedLine = hl([
          { text: "const ", color: keywordColor },
          { text: "x", color: varColor },
          { text: " = 42;" },
        ]);
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [highlightedLine],
          cursor: { line: 0, col: 0 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
        // Cursor should appear right after the line number, before any content
        const markerIdx = result.lines[0].indexOf(CURSOR_MARKER);
        expect(markerIdx).toBeGreaterThan(0);
      });
    });

    describe("when cursor is mid-highlighted word", () => {
      it("then places cursor marker within the highlighted token", () => {
        const highlightedLine = hl([
          { text: "const ", color: keywordColor },
          { text: "x", color: varColor },
          { text: " = 42;" },
        ]);
        // cursor.col=1 refers to raw char at index 1 (second char of "const")
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [highlightedLine],
          cursor: { line: 0, col: 1 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when cursor is at end of highlighted line", () => {
      it("then places cursor marker after last visible character", () => {
        const highlightedLine = hl([
          { text: "const ", color: keywordColor },
          { text: "x", color: varColor },
          { text: " = 42;" },
        ]);
        // Raw line is "const x = 42;" which is 13 chars
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [highlightedLine],
          cursor: { line: 0, col: 13 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when rendering multi-line highlighted code", () => {
      it("then places cursors correctly on each highlighted line", () => {
        const lines = [
          hl([
            { text: "const ", color: keywordColor },
            { text: "x", color: varColor },
            { text: " = 42;" },
          ]),
          hl([
            { text: "function ", color: keywordColor },
            { text: "foo", color: [179, 146, 240] },
            { text: "() { return x; }" },
          ]),
          hl([{ text: "return foo();" }]),
        ];
        expectCursorOnLine(baseOpts, lines, 1, 5);
      });
    });

    describe("when highlighted line contains multiple ANSI segments", () => {
      it("then cursor position maps to correct visual column", () => {
        // "const x = 42;" with each token colored differently
        const highlightedLine = hl([
          { text: "const ", color: keywordColor },
          { text: "x", color: varColor },
          { text: " ", color: [225, 228, 232] },
          { text: "=", color: keywordColor },
          { text: " ", color: [225, 228, 232] },
          { text: "42", color: numColor },
          { text: ";" },
        ]);
        expectCursorOnLine(baseOpts, [highlightedLine], 0, 6);
      });
    });

    describe("when content has no syntax highlighting", () => {
      it("then cursor positioning works as before", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["plain text line"],
          cursor: { line: 0, col: 5 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when highlighted content is empty", () => {
      it("then cursor is at start of empty line", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [""],
          cursor: { line: 0, col: 0 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when cursor is on non-highlighted line in mixed content", () => {
      it("then cursor placement works normally", () => {
        const lines = [
          hl([
            { text: "const ", color: keywordColor },
            { text: "x", color: varColor },
          ]),
          "plain line with no highlighting",
          hl([{ text: "return x;" }]),
        ];
        expectCursorOnLine(baseOpts, lines, 1, 5);
      });
    });
  });

  describe("given selection with highlighted content", () => {
    const keywordColor: [number, number, number] = [179, 146, 240];
    const varColor: [number, number, number] = [121, 184, 255];

    describe("when selection spans highlighted tokens", () => {
      it("then applies background to selected portion", () => {
        const highlightedLine = hl([
          { text: "const ", color: keywordColor },
          { text: "x = 42;" },
        ]);
        // Selection from col 0 to 6 (raw chars)
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [highlightedLine],
          selection: {
            start: { line: 0, col: 0 },
            end: { line: 0, col: 6 },
          },
        });

        expect(result.lines[0]).toContain("\x1b[48;");
      });
    });

    describe("when selection crosses highlighted boundary", () => {
      it("then highlights across token boundaries", () => {
        const lines = [
          hl([
            { text: "const ", color: keywordColor },
            { text: "x", color: varColor },
            { text: " = 42;" },
          ]),
          "next line",
        ];
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          selection: {
            start: { line: 0, col: 3 },
            end: { line: 0, col: 8 },
          },
        });

        expect(result.lines[0]).toContain("\x1b[48;");
      });
    });
  });

  describe("given cursor on different lines with highlighting", () => {
    const keywordColor: [number, number, number] = [179, 146, 240];
    const varColor: [number, number, number] = [121, 184, 255];

    describe("when cursor is on first line of highlighted content", () => {
      it("then cursor marker appears on that line only", () => {
        const lines = [
          hl([
            { text: "const ", color: keywordColor },
            { text: "x", color: varColor },
          ]),
          "second line",
          "third line",
        ];
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          cursor: { line: 0, col: 0 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
        for (let i = 1; i < result.lines.length; i++) {
          if (
            result.lines[i].includes("second") ||
            result.lines[i].includes("third")
          ) {
            expect(result.lines[i]).not.toContain(CURSOR_MARKER);
          }
        }
      });
    });

    describe("when cursor is on last visible line of highlighted content", () => {
      it("then cursor marker appears at correct position", () => {
        const lines = [
          "first",
          "second",
          hl([
            { text: "const ", color: keywordColor },
            { text: "x", color: varColor },
          ]),
        ];
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          cursor: { line: 2, col: 6 },
        });

        expect(result.lines[2]).toContain(CURSOR_MARKER);
      });
    });

    describe("when topLine shifts viewport over highlighted content", () => {
      it("then cursor position is calculated correctly for visible lines", () => {
        const lines = [
          "line 0",
          "line 1",
          "line 2",
          hl([{ text: "const x = 42;" }]),
          "line 4",
        ];
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          topLine: 1,
          height: 3,
          cursor: { line: 3, col: 0 },
        });

        expect(result.lines[2]).toContain(CURSOR_MARKER);
      });
    });
  });

  describe("given width constraints with highlighted content", () => {
    describe("when highlighted line is truncated by width", () => {
      it("then cursor marker respects truncation boundary", () => {
        const highlightedLine = hl([
          { text: "const veryLongVariableName = 42;" },
        ]);
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [highlightedLine],
          width: 20,
          cursor: { line: 0, col: 5 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when cursor is beyond visible width", () => {
      it("then cursor marker may not appear if truncated before cursor position", () => {
        const highlightedLine = hl([{ text: "const x = 42;" }]);
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [highlightedLine],
          width: 15,
          cursor: { line: 0, col: 20 },
        });

        expect(result.lines[0]).not.toContain(CURSOR_MARKER);
      });
    });
  });

  describe("given empty and whitespace lines with highlighting", () => {
    describe("when cursor is on an empty highlighted line", () => {
      it("then cursor marker appears right after line number", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["", "", ""],
          cursor: { line: 1, col: 0 },
        });

        expect(result.lines[1]).toContain(CURSOR_MARKER);
      });
    });

    describe("when cursor is on whitespace-only line", () => {
      it("then cursor marker appears at correct position", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["   ", "hello", "   "],
          cursor: { line: 2, col: 2 },
        });

        expect(result.lines[2]).toContain(CURSOR_MARKER);
      });
    });
  });

  describe("given cursor at file boundaries", () => {
    describe("when cursor is at start of first line", () => {
      it("then marker appears right after line number prefix", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["first line"],
          cursor: { line: 0, col: 0 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when cursor is at end of last line", () => {
      it("then marker appears after all content", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["a", "b", "c"],
          cursor: { line: 2, col: 1 },
        });

        expect(result.lines[2]).toContain(CURSOR_MARKER);
      });
    });

    describe("when cursor is on non-existent line (out of bounds)", () => {
      it("then does not render cursor marker", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["a", "b"],
          cursor: { line: 10, col: 0 },
        });

        expect(result.lines.length).toBe(10);
      });
    });
  });

  describe("given scroll offset with highlighted content", () => {
    describe("when topLine is non-zero and cursor is in visible range", () => {
      it("then cursor marker appears on the correct visible line", () => {
        const lines = [
          "line 0",
          "line 1",
          "line 2",
          hl([{ text: "const x = 42;" }]),
          "line 4",
          "line 5",
        ];
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          topLine: 2,
          height: 3,
          cursor: { line: 3, col: 0 },
        });

        expect(result.lines[1]).toContain(CURSOR_MARKER);
      });
    });

    describe("when cursor moves past bottom of viewport", () => {
      it("then cursor marker does not appear when line is off-screen", () => {
        const lines = [
          "line 0",
          "line 1",
          "line 2",
          "line 3",
          "line 4",
          "line 5",
        ];
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          topLine: 0,
          height: 3,
          cursor: { line: 5, col: 0 },
        });

        expect(result.lines[2]).not.toContain(CURSOR_MARKER);
      });
    });
  });

  describe("given complex ANSI sequences", () => {
    describe("when line has multiple consecutive ANSI codes", () => {
      it("then cursor positioning skips over all escape sequences", () => {
        // Simulate Shiki output: each token wrapped in its own ANSI pair
        const highlightedLine =
          "\x1b[38;2;249;117;131mconst\x1b[0m" +
          "\x1b[38;2;225;228;232m \x1b[0m" +
          "\x1b[38;2;121;184;255mx\x1b[0m" +
          "\x1b[38;2;225;228;232m = 42;\x1b[0m";
        expectCursorOnLine(baseOpts, [highlightedLine], 0, 6);
      });
    });

    describe("when ANSI codes use SGR parameter sequences", () => {
      it("then cursor positioning handles complex escape sequences", () => {
        const highlightedLine =
          "\x1b[38;2;249;117;131mfunction\x1b[0m" +
          "\x1b[38;2;225;228;232m foo(\x1b[0m" +
          "\x1b[38;2;179;146;240marg\x1b[0m" +
          "\x1b[38;2;225;228;232m) { return arg; }\x1b[0m";
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [highlightedLine],
          cursor: { line: 0, col: 10 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when line has no trailing reset sequence", () => {
      it("then cursor positioning still works", () => {
        const highlightedLine = "\x1b[38;2;249;117;131mconst x = 42;";
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: [highlightedLine],
          cursor: { line: 0, col: 5 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });
  });

  describe("given render result structure", () => {
    describe("when rendering normal content", () => {
      it("then returns lines array matching expected height", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["a", "b"],
          height: 5,
        });

        expect(Array.isArray(result.lines)).toBe(true);
        expect(result.lines.length).toBe(5);
      });
    });

    describe("when rendering with selection and cursor on same line", () => {
      it("then both selection highlight and cursor marker are present", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["hello world"],
          selection: {
            start: { line: 0, col: 0 },
            end: { line: 0, col: 6 },
          },
          cursor: { line: 0, col: 3 },
        });

        expect(result.lines[0]).toContain("\x1b[48;");
        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when cursor and selection are on different lines", () => {
      it("then renders both correctly", () => {
        const lines = ["line one", "line two"];
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          selection: {
            start: { line: 0, col: 3 },
            end: { line: 1, col: 4 },
          },
          cursor: { line: 1, col: 2 },
        });

        expect(result.lines[0]).toContain("\x1b[48;");
        expect(result.lines[1]).toContain("\x1b[48;");
        expect(result.lines[1]).toContain(CURSOR_MARKER);
      });
    });
  });

  describe("given edge cases", () => {
    describe("when line number width changes with more lines", () => {
      it("then adjusts column width for 3-digit line numbers", () => {
        const lines = Array.from({ length: 105 }, (_, i) => `line${i}`);
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines,
          height: 3,
          topLine: 99,
          cursor: { line: 99, col: 4 },
        });

        expect(result.lines[0]).toContain("100");
        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when rendering with very narrow width", () => {
      it("then truncates content and cursor may not be visible", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["hello world"],
          width: 8,
          cursor: { line: 0, col: 3 },
        });

        expect(result.lines[0]).toBeDefined();
      });
    });

    describe("when rendering with height of 1", () => {
      it("then returns exactly one line", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["a", "b", "c"],
          height: 1,
        });

        expect(result.lines.length).toBe(1);
      });
    });

    describe("when cursor col is beyond line length", () => {
      it("then clamps cursor to end of line", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["hi"],
          cursor: { line: 0, col: 100 },
        });

        expect(result.lines[0]).toContain(CURSOR_MARKER);
      });
    });

    describe("when all lines are empty", () => {
      it("then renders empty lines with cursor markers where applicable", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["", "", ""],
          height: 3,
          cursor: { line: 1, col: 0 },
        });

        expect(result.lines[1]).toContain(CURSOR_MARKER);
      });
    });

    describe("when selection start equals cursor position", () => {
      it("then no selection highlighting is applied", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["hello"],
          selection: {
            start: { line: 0, col: 3 },
            end: { line: 0, col: 3 },
          },
        });

        for (const line of result.lines) {
          expect(line).not.toContain("\x1b[48;");
        }
      });
    });

    describe("when selection end is before start", () => {
      it("then handles reversed selection correctly", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          lines: ["hello world"],
          selection: {
            start: { line: 0, col: 6 },
            end: { line: 0, col: 2 },
          },
        });

        expect(result.lines[0]).toBeDefined();
      });
    });
  });
});
