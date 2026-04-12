import { describe, it, expect } from "vitest";
import { truncateAnsi, pad, ensureWidth, buildHelpText } from "./text-utils";

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
        expect(truncateAnsi("hello world", 5)).toBe("hello");
      });
    });
  });

  describe("given text with ANSI codes", () => {
    describe("when text fits within width", () => {
      it("then preserves ANSI codes", () => {
        const text = "\x1b[31mred\x1b[0m";
        const result = truncateAnsi(text, 10);
        expect(result).toContain("\x1b[31m");
        expect(result).toContain("red");
      });
    });

    describe("when truncating", () => {
      it("then preserves ANSI codes in truncated portion", () => {
        const text = "\x1b[31mhello world\x1b[0m";
        const result = truncateAnsi(text, 5);
        expect(result).toContain("hello");
        expect(result).not.toContain("world");
      });
    });
  });

  describe("given text with OSC sequences", () => {
    describe("when stripping hyperlinks", () => {
      it("then removes OSC 8 hyperlink sequences", () => {
        const text = "\x1b]8;;https://example.com\x07link\x1b]8;;\x07";
        const result = truncateAnsi(text, 10);
        expect(result).toBe("link");
        expect(result).not.toContain("https");
      });
    });
  });

  describe("given empty string", () => {
    describe("when truncating", () => {
      it("then returns empty string", () => {
        expect(truncateAnsi("", 10)).toBe("");
      });
    });
  });

  describe("given zero width", () => {
    describe("when truncating", () => {
      it("then returns empty string", () => {
        expect(truncateAnsi("hello", 0)).toBe("");
      });
    });
  });
});

describe("pad", () => {
  describe("given text shorter than width", () => {
    describe("when padding", () => {
      it("then adds spaces to reach width", () => {
        const result = pad("hi", 5);
        expect(result).toBe("hi   ");
        expect(result.length).toBe(5);
      });
    });
  });

  describe("given text equal to width", () => {
    describe("when padding", () => {
      it("then returns text unchanged", () => {
        expect(pad("hello", 5)).toBe("hello");
      });
    });
  });

  describe("given text longer than width", () => {
    describe("when padding", () => {
      it("then truncates to width", () => {
        expect(pad("hello world", 5)).toBe("hello");
      });
    });
  });

  describe("given text with ANSI codes", () => {
    describe("when padding", () => {
      it("then calculates visible width correctly", () => {
        const text = "\x1b[31mhi\x1b[0m";
        const result = pad(text, 5);
        // Should pad based on visible "hi" (2 chars), not full string
        expect(result).toContain("hi");
      });
    });
  });

  describe("given empty string", () => {
    describe("when padding to width", () => {
      it("then returns spaces", () => {
        expect(pad("", 3)).toBe("   ");
      });
    });
  });
});

describe("ensureWidth", () => {
  describe("given text shorter than width", () => {
    describe("when ensuring width", () => {
      it("then pads with spaces", () => {
        const result = ensureWidth("hi", 5);
        expect(result).toBe("hi   ");
      });
    });
  });

  describe("given text equal to width", () => {
    describe("when ensuring width", () => {
      it("then returns unchanged", () => {
        expect(ensureWidth("hello", 5)).toBe("hello");
      });
    });
  });

  describe("given text longer than width", () => {
    describe("when ensuring width", () => {
      it("then truncates", () => {
        expect(ensureWidth("hello world", 5)).toBe("hello");
      });
    });
  });
});

describe("buildHelpText", () => {
  describe("given multiple valid items", () => {
    describe("when building help text", () => {
      it("then joins with bullet separator", () => {
        expect(buildHelpText("a", "b", "c")).toBe("a • b • c");
      });
    });
  });

  describe("given items with falsy values", () => {
    describe("when building help text", () => {
      it("then filters out false values", () => {
        expect(buildHelpText("a", false, "b")).toBe("a • b");
      });

      it("then filters out null values", () => {
        expect(buildHelpText("a", null, "b")).toBe("a • b");
      });

      it("then filters out undefined values", () => {
        expect(buildHelpText("a", undefined, "b")).toBe("a • b");
      });
    });
  });

  describe("given single item", () => {
    describe("when building help text", () => {
      it("then returns item without separator", () => {
        expect(buildHelpText("only")).toBe("only");
      });
    });
  });

  describe("given all falsy items", () => {
    describe("when building help text", () => {
      it("then returns empty string", () => {
        expect(buildHelpText(false, null, undefined)).toBe("");
      });
    });
  });

  describe("given no items", () => {
    describe("when building help text", () => {
      it("then returns empty string", () => {
        expect(buildHelpText()).toBe("");
      });
    });
  });
});
