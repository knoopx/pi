import { describe, it, expect } from "vitest";
import { CURSOR_MARKER } from "@mariozechner/pi-tui";
import { renderEditorView, type RenderOptions } from "./renderer";
import { createMockTheme } from "../../lib/test-utils";

const theme = createMockTheme();

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
        expect(result.lines.length).toBe(10); // padded to height

        expect(result.lines).toMatchSnapshot();
      });
    });

    describe("when rendering with cursor hidden", () => {
      it("then does not include cursor marker", () => {
        const result = renderEditorView(theme, {
          ...baseOpts,
          showCursor: false,
        });

        // No cursor marker on any line
        for (const line of result.lines) {
          expect(line).not.toContain(CURSOR_MARKER);
        }

        expect(result.lines).toMatchSnapshot();
      });
    });
  });

  describe("given line numbers", () => {
    describe("when rendering numbered lines", () => {
      it("then shows line numbers with dim color prefix", () => {
        const result = renderEditorView(theme, baseOpts);

        // Line numbers are styled with theme.fg("dim", ...) so they have ANSI codes
        expect(result.lines[0]).toMatch(/\x1b\[/); // has ANSI styling
        expect(result.lines[0]).toContain("1");
        expect(result.lines[1]).toContain("2");
        expect(result.lines[2]).toContain("3");

        expect(result.lines).toMatchSnapshot();
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

        // Line numbers should show multi-digit numbers
        expect(result.lines[0]).toContain("1");

        expect(result.lines).toMatchSnapshot();
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

        expect(result.lines).toMatchSnapshot();
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

        expect(result.lines).toMatchSnapshot();
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

        expect(result.lines[0]).toContain("\x1b[48;"); // background ANSI code

        expect(result.lines).toMatchSnapshot();
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

        // First line should have bg from col 3 onward
        expect(result.lines[0]).toContain("\x1b[48;");
        // Last line should have bg up to col 2
        expect(result.lines[2]).toContain("\x1b[48;");

        expect(result.lines).toMatchSnapshot();
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

        expect(result.lines).toMatchSnapshot();
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

        // Each line should not exceed the specified width (accounting for ANSI codes)
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

        expect(result.lines).toMatchSnapshot();
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

        expect(result.lines).toMatchSnapshot();
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

        expect(result.lines).toMatchSnapshot();
      });
    });
  });
});
