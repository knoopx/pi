import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureWidth } from "./text-utils";
import { loadFilePreviewWithShiki } from "./file-preview";
import { formatBookmarkReference } from "./change-utils";
import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import stringWidth from "string-width";

describe("utils", () => {
  describe("loadFilePreviewWithShiki", () => {
    let mockTheme: Theme;

    beforeEach(() => {
      mockTheme = {
        getFgAnsi: vi.fn(() => "\x1b[90m"),
      } as unknown as Theme;
    });

    describe("when loading file preview with TypeScript", () => {
      it("then returns syntax-highlighted lines", async () => {
        const content = "const x = 1;";
        const result = await loadFilePreviewWithShiki(
          "test.ts",
          content,
          mockTheme,
        );

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe("when file is empty", () => {
      it("then returns array with empty string", async () => {
        const result = await loadFilePreviewWithShiki(
          "empty.ts",
          "",
          mockTheme,
        );

        expect(result).toEqual([""]);
      });
    });

    describe("given error in shiki", () => {
      it("then returns plain lines as fallback", async () => {
        const content = "line1\nline2";
        const mockThemeError = {
          getFgAnsi: vi.fn(() => {
            throw new Error("test");
          }),
        } as unknown as Theme;

        const result = await loadFilePreviewWithShiki(
          "test.ts",
          content,
          mockThemeError,
        );

        expect(result).toEqual(["line1", "line2"]);
      });
    });
  });

  describe("formatBookmarkReference", () => {
    let mockTheme: Theme;

    beforeEach(() => {
      mockTheme = {
        fg: vi.fn((color, text) => `[${color}]${text}[/${color}]`),
        inverse: vi.fn((text) => `[inverse]${text}[/inverse]`),
      } as unknown as Theme;
    });

    describe("given a bookmark name", () => {
      it("then formats with icon and inverse accent background", () => {
        const result = formatBookmarkReference(mockTheme, "main");
        expect(result).toBe("[inverse][accent] 󰃀 main [/accent][/inverse]");
        expect(mockTheme.fg).toHaveBeenCalledWith("accent", " 󰃀 main ");
        expect(mockTheme.inverse).toHaveBeenCalledWith(
          "[accent] 󰃀 main [/accent]",
        );
      });
    });

    describe("given empty bookmark", () => {
      it("then returns icon with empty name", () => {
        const result = formatBookmarkReference(mockTheme, "");
        expect(result).toBe("[inverse][accent] 󰃀  [/accent][/inverse]");
      });
    });

    describe("given bookmark with special characters", () => {
      it("then preserves special characters", () => {
        const result = formatBookmarkReference(mockTheme, "feature/test-123");
        expect(result).toBe(
          "[inverse][accent] 󰃀 feature/test-123 [/accent][/inverse]",
        );
      });
    });
  });

  describe("OSC sequence edge cases", () => {
    describe("given complex real-world crash content", () => {
      const crashPatterns = [
        {
          desc: "ANSI reset followed by bare OSC",
          input: "[0m]8;;",
          shouldNotContain: "]8;;",
        },
        {
          desc: "nested ANSI with OSC terminator",
          input:
            "[48;2;30;19;60m [38;2;250;208;0m- [39m[38;2;248;248;248m[1m[32magent/extens[0m]8;;",
          shouldNotContain: "]8;;",
        },
        {
          desc: "OSC 8 hyperlink with BEL terminator",
          input: "\x1b]8;;https://x.com\x07text\x1b]8;;\x07",
          shouldContain: "text",
        },
        {
          desc: "multiple bare OSC terminators in one line",
          input: "text]8;;]8;;more",
          shouldContain: "textmore",
        },
      ];

      crashPatterns.forEach(
        ({ desc, input, shouldNotContain, shouldContain }) => {
          describe(`when processing ${desc}`, () => {
            it("then handles width calculation correctly", () => {
              const result = ensureWidth(input, 100);
              expect(stringWidth(result)).toBe(100);

              if (shouldNotContain) expect(result).not.toContain(shouldNotContain);
              if (shouldContain) expect(result).toContain(shouldContain);
            });
          });
        },
      );
    });

    describe("given width exactly at terminal boundary", () => {
      it("then never exceeds specified width", () => {
        const terminalWidth = 295;
        const problematicContent =
          "[48;2;30;19;60m [38;2;250;208;0m- [39m[38;2;248;248;248m[1m[32magent/extens[0m]8;;";

        const result = ensureWidth(problematicContent, terminalWidth);
        const actualWidth = stringWidth(result);

        expect(actualWidth).toBe(terminalWidth);
        expect(actualWidth).not.toBeGreaterThan(terminalWidth);
      });
    });
  });
});
