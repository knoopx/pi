import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureWidth } from "./text-utils";
import { loadFilePreviewWithBat } from "./file-preview";
import { formatBookmarkReference } from "./change-utils";
import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import stringWidth from "string-width";

describe("utils", () => {

  describe("loadFilePreviewWithBat", () => {
    let mockPi: ExtensionAPI;
    let execMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      execMock = vi.fn();
      mockPi = { exec: execMock } as unknown as ExtensionAPI;
    });

    describe("given bat command succeeds", () => {
      describe("when loading file preview", () => {
        it("then returns lines from stdout", async () => {
          execMock.mockResolvedValue({
            code: 0,
            stdout: "line1\nline2\nline3",
            stderr: "",
            killed: false,
          });

          const result = await loadFilePreviewWithBat(
            mockPi,
            "test.ts",
            "/home/user",
          );

          expect(result).toEqual(["line1", "line2", "line3"]);
          expect(execMock).toHaveBeenCalledWith(
            "bat",
            ["--plain", "--color=always", "test.ts"],
            { cwd: "/home/user" },
          );
        });
      });

      describe("when file is empty", () => {
        it("then returns array with empty string", async () => {
          execMock.mockResolvedValue({
            code: 0,
            stdout: "",
            stderr: "",
            killed: false,
          });

          const result = await loadFilePreviewWithBat(
            mockPi,
            "empty.ts",
            "/home/user",
          );

          expect(result).toEqual([""]);
        });
      });
    });

    describe("given bat command fails", () => {
      describe("when file not found", () => {
        it("then returns error message", async () => {
          execMock.mockResolvedValue({
            code: 1,
            stdout: "",
            stderr: "bat: 'missing.ts': No such file or directory",
            killed: false,
          });

          const result = await loadFilePreviewWithBat(
            mockPi,
            "missing.ts",
            "/home/user",
          );

          expect(result).toEqual([
            "Error reading file: bat: 'missing.ts': No such file or directory",
          ]);
        });
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

              if (shouldNotContain) {
                expect(result).not.toContain(shouldNotContain);
              }
              if (shouldContain) {
                expect(result).toContain(shouldContain);
              }
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
