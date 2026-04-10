import { describe, expect, it } from "vitest";
import { table, type Column } from "./table";

const ANSI_RE = /\x1b\[[0-9;]*m/g;
function strip(text: string): string {
  return text.replace(ANSI_RE, "");
}

// Shared helper to check for blank separator lines
function assertNoBlankSeparatorLines(output: string) {
  const lines = strip(output).split("\n");
  for (const line of lines) {
    expect(line).not.toMatch(/^\s*│\s*$/);
  }
}

describe("table", () => {
  const cols: Column[] = [{ key: "name" }, { key: "score", align: "right" }];

  it("renders header and separator", () => {
    const rows = [{ name: "Alice", score: 100 }];
    const out = strip(table(cols, rows));
    const lines = out.split("\n");
    expect(lines[0]).toMatch(/name\s+│\s+score/);
    expect(lines[1]).toMatch(/─+┼─+/);
  });

  it("renders rows with correct alignment", () => {
    const rows = [
      { name: "Alice", score: 100 },
      { name: "Bob", score: 42 },
    ];
    const out = strip(table(cols, rows));
    const lines = out.split("\n");
    // Data rows start at index 2
    expect(lines[2]).toContain("Alice");
    expect(lines[2]).toContain("100");
    expect(lines[3]).toContain("Bob");
    expect(lines[3]).toContain("42");
  });

  it("right-aligns numeric columns", () => {
    const rows = [
      { name: "A", score: 1 },
      { name: "B", score: 999 },
    ];
    const out = strip(table(cols, rows));
    const lines = out.split("\n");
    // The rightmost digit of 1 and 999 should align at the same column
    const endOf1 = lines[2].lastIndexOf("1");
    const endOf999 = lines[3].lastIndexOf("9");
    expect(endOf1).toBe(endOf999);
  });

  it("handles empty rows", () => {
    const out = table(cols, []);
    expect(out).toBe("");
  });

  it("applies format function", () => {
    const formatted: Column[] = [{ key: "val", format: (v) => `<${v}>` }];
    const out = strip(table(formatted, [{ val: "x" }]));
    expect(out).toContain("<x>");
  });

  it("uses custom indent", () => {
    const out = strip(table(cols, [{ name: "A", score: 1 }], { indent: 2 }));
    expect(out.split("\n")[0]).toMatch(/^ {2}/);
  });

  it("constrains width to maxTableWidth and wraps long text", () => {
    const longCols: Column[] = [
      { key: "#", align: "right", minWidth: 3 },
      {
        key: "title",
        format: (_v, row) => {
          const r = row as { title: string; url: string; desc: string };
          return [r.title, r.desc, r.url].join("\n");
        },
      },
    ];
    const rows = [
      {
        "#": "1",
        title: "Example Title",
        desc: "A very long description that should be wrapped when the table width is constrained to a narrow terminal",
        url: "https://example.com/very/long/path/that/exceeds/column/width",
      },
    ];
    const out = strip(table(longCols, rows, { maxTableWidth: 60 }));
    const lines = out.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
    // Content is still present
    expect(out).toContain("Example Title");
    expect(out).toContain("example.com");
  });

  it("does not shrink right-aligned columns", () => {
    const numCols: Column[] = [
      { key: "#", align: "right", minWidth: 3 },
      { key: "text" },
    ];
    const rows = [{ "#": "1", text: "x".repeat(100) }];
    const out = strip(table(numCols, rows, { maxTableWidth: 40 }));
    const headerLine = out.split("\n")[0];
    // The "#" column should still be present and right-aligned
    expect(headerLine).toMatch(/\s+#\s+│/);
  });

  it("filters out empty segments from consecutive newlines", () => {
    const cols: Column[] = [
      { key: "type", maxWidth: 30 },
      { key: "desc", maxWidth: 40 },
    ];
    const rows = [
      {
        type: "attribute set of string",
        desc: "Input configuration\n\nwritten to file.\n\nSee docs for more.",
      },
      {
        type: "boolean",
        desc: "Whether to enable.\n\ndefault: false",
      },
    ];
    const out = strip(table(cols, rows));
    // Should not have any blank lines or lines with only separators
    assertNoBlankSeparatorLines(table(cols, rows));
    // Content should still be present
    expect(out).toContain("Input configuration");
    expect(out).toContain("written to file");
    expect(out).toContain("See docs for more");
    expect(out).toContain("Whether to enable");
    expect(out).toContain("default: false");
  });

  it("handles leading and trailing newlines", () => {
    const cols: Column[] = [{ key: "col", maxWidth: 20 }];
    const rows = [{ col: "\n\nhello\n\n" }];
    const out = strip(table(cols, rows));
    const lines = out.split("\n");
    // Should not have blank lines at the start of cell content
    const dataLines = lines.slice(2); // Skip header and separator
    expect(dataLines[0]).toBe("hello");
  });

  it("handles many consecutive newlines", () => {
    const cols: Column[] = [{ key: "col" }];
    const rows = [{ col: "line1\n\n\n\n\nline2" }];
    const out = strip(table(cols, rows));
    // Should not have blank separator lines
    assertNoBlankSeparatorLines(table(cols, rows));
    expect(out).toContain("line1");
    expect(out).toContain("line2");
  });

  it("handles empty string cells", () => {
    const cols: Column[] = [{ key: "col" }];
    const rows = [{ col: "" }];
    const out = strip(table(cols, rows));
    const lines = out.split("\n");
    // Should render without errors, just empty cell
    expect(lines[2]).toBe("");
  });

  it("handles cells with only newlines", () => {
    const cols: Column[] = [{ key: "col" }];
    const rows = [{ col: "\n\n\n\n" }];
    // Should render without blank separator lines
    assertNoBlankSeparatorLines(table(cols, rows));
  });

  it("handles multiple rows with varying newline patterns", () => {
    const cols: Column[] = [
      { key: "#", align: "right", minWidth: 3 },
      { key: "desc", maxWidth: 30 },
    ];
    const rows = [
      { "#": "1", desc: "normal text" },
      { "#": "2", desc: "with\n\nempty lines" },
      { "#": "3", desc: "\n\nleading newlines" },
      { "#": "4", desc: "trailing\n\n" },
    ];
    const out = strip(table(cols, rows));
    // No blank separator lines anywhere
    assertNoBlankSeparatorLines(table(cols, rows));
    // All content present
    expect(out).toContain("normal text");
    expect(out).toContain("with");
    expect(out).toContain("empty lines");
    expect(out).toContain("leading newlines");
    expect(out).toContain("trailing");
  });
});
