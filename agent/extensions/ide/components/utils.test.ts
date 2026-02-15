import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  truncateAnsi,
  pad,
  ensureWidth,
  loadFilePreviewWithBat,
  buildHelpText,
  formatBookmarkReference,
} from "./utils";
import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import stringWidth from "string-width";

describe("utils", () => {
  describe("truncateAnsi", () => {
    describe("given plain text", () => {
      describe("when text is shorter than width", () => {
        it("then returns text unchanged", () => {
          expect(truncateAnsi("hello", 10)).toBe("hello");
        });
      });

      describe("when text equals width", () => {
        it("then returns text unchanged", () => {
          expect(truncateAnsi("hello", 5)).toBe("hello");
        });
      });

      describe("when text is longer than width", () => {
        it("then truncates to width", () => {
          const result = truncateAnsi("hello world", 5);
          expect(stringWidth(result)).toBe(5);
          expect(result).toBe("hello");
        });
      });
    });

    describe("given text with ANSI color codes", () => {
      const colorText = "\x1b[31mred text\x1b[0m";

      describe("when text fits within width", () => {
        it("then preserves ANSI codes", () => {
          const result = truncateAnsi(colorText, 20);
          expect(result).toContain("\x1b[31m");
          expect(result).toContain("red text");
        });
      });

      describe("when text needs truncation", () => {
        it("then truncates while preserving ANSI codes", () => {
          const result = truncateAnsi(colorText, 4);
          expect(stringWidth(result)).toBe(4);
        });
      });
    });

    describe("given text with OSC 8 hyperlink sequences", () => {
      describe("when text contains bare ]8;; sequence", () => {
        it("then strips the OSC sequence", () => {
          const text = "[0m]8;;";
          const result = truncateAnsi(text, 10);
          expect(result).not.toContain("]8;;");
          expect(result).toBe("[0m");
        });
      });

      describe("when text contains proper OSC 8 hyperlink", () => {
        it("then strips hyperlink but preserves link text", () => {
          const text = "\x1b]8;;https://example.com\x07link\x1b]8;;\x07";
          const result = truncateAnsi(text, 10);
          expect(result).toContain("link");
          expect(result).not.toContain("https://");
        });
      });

      describe("when text contains OSC 8 with ST terminator", () => {
        it("then strips the OSC sequence", () => {
          const text = "\x1b]8;;file://path\x1b\\text";
          const result = truncateAnsi(text, 10);
          expect(result).toBe("text");
        });
      });

      describe("when text mixes ANSI colors and OSC sequences", () => {
        it("then preserves colors but strips OSC", () => {
          const text = "\x1b[31mred\x1b[0m]8;;extra";
          const result = truncateAnsi(text, 20);
          expect(result).toContain("\x1b[31m");
          expect(result).toContain("red");
          expect(result).not.toContain("]8;;");
        });
      });
    });

    describe("given empty string", () => {
      it("then returns empty string", () => {
        expect(truncateAnsi("", 10)).toBe("");
      });
    });

    describe("given width of zero", () => {
      it("then returns empty string", () => {
        expect(truncateAnsi("hello", 0)).toBe("");
      });
    });
  });

  describe("pad", () => {
    describe("given plain text", () => {
      describe("when text is shorter than width", () => {
        it("then pads with spaces to reach width", () => {
          const result = pad("hi", 5);
          expect(result).toBe("hi   ");
          expect(stringWidth(result)).toBe(5);
        });
      });

      describe("when text equals width", () => {
        it("then returns text unchanged", () => {
          expect(pad("hello", 5)).toBe("hello");
        });
      });

      describe("when text is longer than width", () => {
        it("then truncates to width", () => {
          const result = pad("hello world", 5);
          expect(stringWidth(result)).toBe(5);
        });
      });
    });

    describe("given text with ANSI codes", () => {
      describe("when padding colored text", () => {
        it("then calculates visual width correctly", () => {
          const colorText = "\x1b[31mred\x1b[0m";
          const result = pad(colorText, 10);
          expect(stringWidth(result)).toBe(10);
        });
      });
    });

    describe("given text with OSC sequences", () => {
      describe("when text contains ]8;; sequence", () => {
        it("then strips OSC before padding", () => {
          const text = "abc]8;;extra";
          const result = pad(text, 10);
          expect(result).not.toContain("]8;;");
          expect(stringWidth(result)).toBe(10);
        });
      });
    });

    describe("given empty string", () => {
      it("then returns spaces of specified width", () => {
        const result = pad("", 5);
        expect(result).toBe("     ");
        expect(stringWidth(result)).toBe(5);
      });
    });
  });

  describe("ensureWidth", () => {
    describe("given plain text", () => {
      describe("when text width equals target", () => {
        it("then returns text unchanged", () => {
          expect(ensureWidth("hello", 5)).toBe("hello");
        });
      });

      describe("when text is shorter than target", () => {
        it("then pads to exact width", () => {
          const result = ensureWidth("hi", 5);
          expect(stringWidth(result)).toBe(5);
          expect(result).toBe("hi   ");
        });
      });

      describe("when text is longer than target", () => {
        it("then truncates to exact width", () => {
          const result = ensureWidth("hello world", 5);
          expect(stringWidth(result)).toBe(5);
        });
      });
    });

    describe("given text with ANSI codes", () => {
      describe("when ensuring width of colored text", () => {
        it("then calculates visual width correctly", () => {
          const colorText = "\x1b[32mgreen\x1b[0m";
          const result = ensureWidth(colorText, 10);
          expect(stringWidth(result)).toBe(10);
        });
      });
    });

    describe("given text with OSC sequences", () => {
      describe("when text contains crash-inducing ]8;; sequence", () => {
        it("then strips OSC and ensures correct width", () => {
          // This is the exact pattern that caused the crash
          const crashContent =
            "[48;2;30;19;60m [38;2;250;208;0m- [39m[38;2;248;248;248m[1m[32magent/extens[0m]8;;";
          const result = ensureWidth(crashContent, 100);
          expect(stringWidth(result)).toBe(100);
          expect(result).not.toContain("]8;;");
        });
      });

      describe("when text contains multiple OSC sequences", () => {
        it("then strips all OSC sequences", () => {
          const text = "a]8;;one]8;;twob";
          const result = ensureWidth(text, 10);
          expect(result).not.toContain("]8;;");
          expect(stringWidth(result)).toBe(10);
        });
      });
    });

    describe("given width of zero", () => {
      it("then returns empty string", () => {
        expect(ensureWidth("hello", 0)).toBe("");
      });
    });

    describe("given negative scenarios", () => {
      const edgeCases = [
        { input: "", width: 0, desc: "empty string with zero width" },
        { input: "", width: 5, desc: "empty string with positive width" },
        { input: "   ", width: 3, desc: "only spaces matching width" },
      ];

      edgeCases.forEach(({ input, width, desc }) => {
        describe(`when ${desc}`, () => {
          it("then returns string of exact width", () => {
            const result = ensureWidth(input, width);
            expect(stringWidth(result)).toBe(width);
          });
        });
      });
    });
  });

  describe("loadFilePreviewWithBat", () => {
    let mockPi: ExtensionAPI;

    beforeEach(() => {
      mockPi = {
        exec: vi.fn(),
      } as unknown as ExtensionAPI;
    });

    describe("given bat command succeeds", () => {
      describe("when loading file preview", () => {
        it("then returns lines from stdout", async () => {
          vi.mocked(mockPi.exec).mockResolvedValue({
            code: 0,
            stdout: "line1\nline2\nline3",
            stderr: "",
          });

          const result = await loadFilePreviewWithBat(
            mockPi,
            "test.ts",
            "/home/user",
          );

          expect(result).toEqual(["line1", "line2", "line3"]);
          expect(mockPi.exec).toHaveBeenCalledWith(
            "bat",
            ["--plain", "--color=always", "test.ts"],
            { cwd: "/home/user" },
          );
        });
      });

      describe("when file is empty", () => {
        it("then returns array with empty string", async () => {
          vi.mocked(mockPi.exec).mockResolvedValue({
            code: 0,
            stdout: "",
            stderr: "",
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
          vi.mocked(mockPi.exec).mockResolvedValue({
            code: 1,
            stdout: "",
            stderr: "bat: 'missing.ts': No such file or directory",
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

  describe("buildHelpText", () => {
    describe("given all truthy items", () => {
      it("then joins with bullet separator", () => {
        const result = buildHelpText("item1", "item2", "item3");
        expect(result).toBe("item1 • item2 • item3");
      });
    });

    describe("given mixed truthy and falsy items", () => {
      it("then filters out falsy values", () => {
        const result = buildHelpText("item1", false, "item2", null, "item3");
        expect(result).toBe("item1 • item2 • item3");
      });
    });

    describe("given all falsy items", () => {
      it("then returns empty string", () => {
        const result = buildHelpText(false, null, undefined);
        expect(result).toBe("");
      });
    });

    describe("given single item", () => {
      it("then returns item without separator", () => {
        expect(buildHelpText("only")).toBe("only");
      });
    });

    describe("given no items", () => {
      it("then returns empty string", () => {
        expect(buildHelpText()).toBe("");
      });
    });

    describe("given conditional expressions", () => {
      it("then evaluates conditions correctly", () => {
        const hasFeature = true;
        const isAdmin = false;
        const result = buildHelpText(
          "always",
          hasFeature && "feature",
          isAdmin && "admin",
        );
        expect(result).toBe("always • feature");
      });
    });
  });

  describe("formatBookmarkReference", () => {
    let mockTheme: Theme;

    beforeEach(() => {
      mockTheme = {
        fg: vi.fn((color, text) => `[${color}]${text}[/${color}]`),
      } as unknown as Theme;
    });

    describe("given a bookmark name", () => {
      it("then formats with angle brackets and accent color", () => {
        const result = formatBookmarkReference(mockTheme, "main");
        expect(result).toBe("[accent]<main>[/accent]");
        expect(mockTheme.fg).toHaveBeenCalledWith("accent", "<main>");
      });
    });

    describe("given empty bookmark", () => {
      it("then returns empty angle brackets", () => {
        const result = formatBookmarkReference(mockTheme, "");
        expect(result).toBe("[accent]<>[/accent]");
      });
    });

    describe("given bookmark with special characters", () => {
      it("then preserves special characters", () => {
        const result = formatBookmarkReference(mockTheme, "feature/test-123");
        expect(result).toBe("[accent]<feature/test-123>[/accent]");
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
        ({ desc, input, shouldNotContain, shouldContain, expected }) => {
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
              if (expected) {
                expect(result.trim()).toBe(expected.padEnd(100).trim());
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
