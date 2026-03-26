import { describe, expect, it } from "vitest";
import { table, type Column } from "./table";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function strip(text: string): string {
  return text.replace(ANSI_RE, "");
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
});
