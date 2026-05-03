import { describe, expect, it } from "vitest";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  buildRgCommand,
  parseRgOutput,
  filterResults,
  formatSearchResult,
  highlightMatch,
  countAnsiBytes,
} from "./helpers";
import type { SearchResult } from "./types";

function createMockHighlightTheme(): Theme {
  return {
    fg: (c: string, t: string) => `[${c}:${t}]`,
    bold: (t: string) => `**${t}**`,
  } as unknown as Theme;
}

describe("buildRgCommand", () => {
  it("includes default exclude patterns", () => {
    const args = buildRgCommand("foo");
    expect(args).toContain("-g");
    expect(args).toContain("!node_modules");
    expect(args).toContain("!dist");
    expect(args).toContain("!build");
  });

  it("supports regex: prefix", () => {
    const args = buildRgCommand("regex:\\d+");
    expect(args).toContain("-E");
    expect(args).toContain("\\d+");
  });

  it("supports fixed: prefix", () => {
    const args = buildRgCommand("fixed:some text");
    expect(args).toContain("-F");
    expect(args).toContain("some text");
  });

  it("uses plain query by default", () => {
    const args = buildRgCommand("hello world");
    expect(args).not.toContain("-E");
    expect(args).not.toContain("-F");
  });
});

describe("parseRgOutput", () => {
  it("parses rg JSONL output correctly", () => {
    const jsonl = [
      '{"type":"path","data":{"path":{"text":"src/main.ts"}}}',
      '{"type":"match","data":{"path":{"text":"src/main.ts"},"lines":{"text":"const x = 42;\\n"},"line_number":5,"absolute_offset":0,"submatches":[{"match":{"text":"42"},"start":10,"end":12}]}}',
      '{"type":"match","data":{"path":{"text":"src/main.ts"},"lines":{"text":"const y = 100;\\n"},"line_number":6,"absolute_offset":0,"submatches":[{"match":{"text":"100"},"start":10,"end":13}]}}',
    ].join("\n");

    const results = parseRgOutput(jsonl);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe("src/main.ts");
    expect(results[0].lineNum).toBe(5);
    expect(results[0].colNum).toBe(0);
    expect(results[0].lineText).toBe("const x = 42;\n");
    expect(results[0].matchedText).toBe("42");
    expect(results[0].label).toBe("const x = 42;");
    expect(results[1].path).toBe("src/main.ts");
    expect(results[1].lineNum).toBe(6);
    expect(results[1].colNum).toBe(0);
    expect(results[1].lineText).toBe("const y = 100;\n");
    expect(results[1].matchedText).toBe("100");
  });

  it("handles empty output", () => {
    const results = parseRgOutput("");
    expect(results).toHaveLength(0);
  });

  it("skips malformed JSON lines", () => {
    const jsonl = [
      '{"type":"path","data":{"path":{"text":"src/app.ts"}}}',
      "not valid json",
      '{"type":"match","data":{"path":{"text":"src/app.ts"},"lines":{"text":"hello world\\n"},"line_number":1,"absolute_offset":0,"submatches":[{"match":{"text":"hello"},"start":0,"end":5}]}}',
    ].join("\n");

    const results = parseRgOutput(jsonl);
    expect(results).toHaveLength(1);
  });
});

describe("filterResults", () => {
  it("filters by line text", () => {
    const items: SearchResult[] = [
      {
        id: "a:1",
        label: "foo bar",
        path: "a.ts",
        lineNum: 1,
        colNum: 1,
        lineText: "foo bar",
        matchedText: "foo",
      },
      {
        id: "b:2",
        label: "baz qux",
        path: "b.ts",
        lineNum: 2,
        colNum: 1,
        lineText: "baz qux",
        matchedText: "baz",
      },
    ];

    const filtered = filterResults(items, "foo");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].path).toBe("a.ts");
  });

  it("filters by path", () => {
    const items: SearchResult[] = [
      {
        id: "a:1",
        label: "hello",
        path: "src/a.ts",
        lineNum: 1,
        colNum: 1,
        lineText: "hello",
        matchedText: "hello",
      },
      {
        id: "b:2",
        label: "world",
        path: "lib/b.ts",
        lineNum: 2,
        colNum: 1,
        lineText: "world",
        matchedText: "world",
      },
    ];

    const filtered = filterResults(items, "lib");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].path).toBe("lib/b.ts");
  });

  it("returns all results when query is empty", () => {
    const items: SearchResult[] = [
      {
        id: "a:1",
        label: "foo",
        path: "a.ts",
        lineNum: 1,
        colNum: 1,
        lineText: "foo",
        matchedText: "foo",
      },
      {
        id: "b:2",
        label: "bar",
        path: "b.ts",
        lineNum: 2,
        colNum: 1,
        lineText: "bar",
        matchedText: "bar",
      },
    ];

    const filtered = filterResults(items, "");
    expect(filtered).toHaveLength(2);
  });
});

describe("highlightMatch", () => {
  it("highlights the matched text with accent color and bold", () => {
    const theme = {
      fg: (color: string, text: string) => `[${color}:${text}]`,
      bold: (text: string) => `**${text}**`,
    } as unknown as Theme;

    const result = highlightMatch("const x = 42;", "42", theme);
    expect(result).toContain("[accent:**42**]");
    expect(result).toContain("const x = ");
    expect(result).toContain(";");
  });

  it("returns original text when match is empty", () => {
    const theme = createMockHighlightTheme();
    expect(highlightMatch("hello world", "", theme)).toBe("hello world");
  });

  it("returns original text when match is not found", () => {
    const theme = createMockHighlightTheme();
    expect(highlightMatch("hello world", "xyz", theme)).toBe("hello world");
  });

  it("is case-insensitive", () => {
    const theme = {
      fg: (c: string, t: string) => `[${c}:${t}]`,
      bold: (t: string) => `**${t}**`,
    } as unknown as Theme;
    const result = highlightMatch("Hello World", "WORLD", theme);
    expect(result).toContain("[accent:**World**]");
  });
});

describe("formatSearchResult", () => {
  it("includes path and line number", () => {
    const theme = {} as Theme;

    const result: SearchResult = {
      id: "src/app.ts:5:13",
      label: "const x = 42;",
      path: "src/app.ts",
      lineNum: 5,
      colNum: 13,
      lineText: "const x = 42;",
      matchedText: "42",
    };

    const formatted = formatSearchResult(80, theme, result);
    expect(formatted).toBe("src/app.ts:5");
  });
});

describe("countAnsiBytes", () => {
  it("returns plain text length for non-ANSI strings", () => {
    expect(countAnsiBytes("hello world", "hello")).toBe(5);
    expect(countAnsiBytes("hello world", "hello ")).toBe(6);
    expect(countAnsiBytes("hello world", "hello world")).toBe(11);
  });

  it("handles ANSI escape sequences correctly", () => {
    const ESC = "\x1b";
    const boldCode = `${ESC}[1m`; // 4 bytes
    const resetCode = `${ESC}[0m`; // 4 bytes
    const ansiText = `${boldCode}hello${resetCode} world`;

    expect(countAnsiBytes(ansiText, "hello")).toBe(9);
    expect(countAnsiBytes(ansiText, "hello ")).toBe(14);
  });

  it("handles per-character RGB color codes (shiki format)", () => {
    const ESC = "\x1b";
    const rgbCode = `${ESC}[38;2;100;150;200m`;
    const text = "const hello world";
    const ansiText = [...text].map((c) => rgbCode + c).join("");

    expect(countAnsiBytes(ansiText, "const ")).toBe(120);

    const remaining = ansiText.substring(120);
    expect(remaining.startsWith(rgbCode + "h")).toBe(true);

    expect(countAnsiBytes(remaining, "hello")).toBe(100);
  });

  it("returns position at ANSI-safe boundary after fix", () => {
    const ESC = "\x1b";
    const rgbCode = `${ESC}[38;2;100;150;200m`;
    const text = "const hello world";
    const ansiText = [...text].map((c) => rgbCode + c).join("");

    const pos = countAnsiBytes(ansiText, "const ");
    if (pos > 0 && ansiText[pos] === ESC) {
    } else if (
      pos >= 2 &&
      ansiText[pos - 2] === ESC &&
      ansiText[pos - 1] !== "m"
    ) {
      expect.fail(`Position ${pos} falls inside an escape sequence`);
    }
  });
});
