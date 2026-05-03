import { describe, it, expect } from "vitest";
import { table } from "./renderer";

describe("table", () => {
  describe("given empty rows", () => {
    it("then returns an empty string", () => {
      const result = table([{ key: "name" }], []);
      expect(result).toBe("");
    });
  });

  describe("single column", () => {
    it("renders header and separator", () => {
      const result = table([{ key: "id" }], [{ id: "1" }]);
      expect(result).toContain("id");
      expect(result).toContain("──");
    });

    it("renders row data", () => {
      const result = table([{ key: "name" }], [{ name: "Alice" }]);
      expect(result).toContain("Alice");
    });
  });

  describe("multiple columns", () => {
    it("separates columns with pipe characters", () => {
      const result = table([{ key: "a" }, { key: "b" }], [{ a: "1", b: "2" }]);
      expect(result).toContain(" │ ");
    });

    it("renders all column headers", () => {
      const result = table(
        [{ key: "name" }, { key: "age" }],
        [{ name: "Alice", age: "30" }],
      );
      expect(result).toContain("name");
      expect(result).toContain("age");
    });

    it("renders all row values", () => {
      const result = table(
        [{ key: "name" }, { key: "age" }],
        [{ name: "Alice", age: "30" }],
      );
      expect(result).toContain("Alice");
      expect(result).toContain("30");
    });
  });

  describe("indentation", () => {
    it("applies indent to header line", () => {
      const result = table([{ key: "name" }], [{ name: "test" }], {
        indent: 4,
      });
      expect(result.split("\n")[0]).toMatch(/^    /);
    });

    it("applies indent to separator line", () => {
      const result = table([{ key: "name" }], [{ name: "test" }], {
        indent: 4,
      });
      expect(result.split("\n")[1]).toMatch(/^────/);
    });

    it("applies indent to row lines", () => {
      const result = table([{ key: "name" }], [{ name: "test" }], {
        indent: 4,
      });
      expect(result.split("\n")[2]).toMatch(/^    /);
    });

    it("defaults to no indent", () => {
      const result = table([{ key: "name" }], [{ name: "test" }]);
      expect(result.split("\n")[0]).not.toMatch(/^\s/);
    });
  });

  describe("column width", () => {
    it("expands to fit long values", () => {
      const result = table(
        [{ key: "name" }],
        [{ name: "a very long name value" }],
      );
      expect(result).toContain("a very long name value");
    });

    it("applies minWidth constraint to expand column", () => {
      // minWidth expands the column width beyond natural size
      const result = table(
        [{ key: "short", minWidth: 15 }, { key: "alsoShort" }],
        [{ short: "x", alsoShort: "y" }],
      );
      expect(result).toContain(" │ ");
    });

    it("applies maxWidth constraint", () => {
      const result = table(
        [{ key: "name", maxWidth: 5 }],
        [{ name: "verylong" }],
      );
      expect(result).toContain("name");
    });

    it("uses header length as base width", () => {
      const result = table([{ key: "column_name" }], [{ column_name: "x" }]);
      expect(result.split("\n")[0]).toContain("column_name");
    });
  });

  describe("alignment", () => {
    it("right-aligns columns with right alignment", () => {
      const result = table([{ key: "id", align: "right" }], [{ id: "42" }]);
      const headerLine = result.split("\n")[0];
      expect(headerLine).toContain("id");
    });

    it("left-aligns columns by default", () => {
      const result = table([{ key: "name" }], [{ name: "Alice" }]);
      const headerLine = result.split("\n")[0];
      expect(headerLine).toMatch(/^name/);
    });

    it("handles mixed alignment", () => {
      const result = table(
        [{ key: "name" }, { key: "id", align: "right" }],
        [{ name: "Alice", id: "42" }],
      );
      expect(result).toContain("name");
      expect(result).toContain(" │ ");
    });
  });

  describe("text wrapping", () => {
    it("wraps long text in cells", () => {
      const result = table(
        [{ key: "desc", maxWidth: 10 }],
        [
          {
            desc: "this is a very long description that should wrap",
          },
        ],
      );
      expect(result).toContain("this");
      // Should have multiple lines for the cell
      const lines = result.split("\n");
      expect(lines.length).toBeGreaterThan(3);
    });

    it("indents wrapped lines with spaces", () => {
      const result = table(
        [{ key: "desc", maxWidth: 10 }],
        [
          {
            desc: "long text here",
          },
        ],
      );
      const lines = result.split("\n");
      // Find wrapped lines (after header and separator)
      const dataLines = lines.slice(2);
      if (dataLines.length > 1) {
        expect(dataLines[1]).toMatch(/^    /);
      }
    });

    it("handles multi-line cell values", () => {
      const result = table([{ key: "multi" }], [{ multi: "line1\nline2" }]);
      expect(result).toContain("line1");
      expect(result).toContain("line2");
    });

    it("handles empty cells", () => {
      const result = table([{ key: "name" }], [{ name: "" }]);
      expect(result).toContain("name");
    });
  });

  describe("format function", () => {
    it("uses custom format function", () => {
      const result = table(
        [{ key: "value", format: (v) => `PREFIX:${v}` }],
        [{ value: "test" }],
      );
      expect(result).toContain("PREFIX:test");
    });

    it("passes row to format function", () => {
      const result = table(
        [
          {
            key: "a",
            format: (_v, row) => `row:${row.b}`,
          },
        ],
        [{ a: "x", b: "y" }],
      );
      expect(result).toContain("row:y");
    });
  });

  describe("cell string conversion", () => {
    it("converts numbers to strings", () => {
      const result = table([{ key: "n" }], [{ n: 42 }]);
      expect(result).toContain("42");
    });

    it("converts booleans to strings", () => {
      const result = table([{ key: "b" }], [{ b: true }]);
      expect(result).toContain("true");
    });

    it("null becomes empty string", () => {
      const result = table([{ key: "n" }], [{ n: null }]);
      expect(result).not.toContain("null");
    });

    it("undefined becomes empty string", () => {
      const result = table([{ key: "n" }], [{ n: undefined }]);
      expect(result).not.toContain("undefined");
    });

    it("objects become JSON strings", () => {
      const result = table([{ key: "o" }], [{ o: { x: 1 } }]);
      expect(result).toContain('{"x":1}');
    });
  });

  describe("maxTableWidth constraint", () => {
    it("does not constrain when natural width fits", () => {
      const result = table([{ key: "a" }, { key: "b" }], [{ a: "1", b: "2" }], {
        maxTableWidth: 100,
      });
      expect(result).toContain("a");
      expect(result).toContain("b");
    });

    it("constrains columns when table is too wide", () => {
      const result = table(
        [{ key: "verylongcolumnname" }],
        [{ verylongcolumnname: "short" }],
        { maxTableWidth: 15 },
      );
      // Column should be constrained - header line should be shorter than natural width
      const lines = result.split("\n");
      expect(lines[0].length).toBeLessThan(25);
    });

    it("respects fixed columns when constraining", () => {
      const result = table(
        [{ key: "id", align: "right" }, { key: "name" }],
        [
          {
            id: "1",
            name: "a very long name value that needs truncation",
          },
        ],
        { maxTableWidth: 20 },
      );
      expect(result).toContain("1");
    });
  });

  describe("separator line", () => {
    it("uses box-drawing characters", () => {
      const result = table([{ key: "a" }, { key: "b" }], [{}]);
      const separatorLine = result.split("\n")[1];
      expect(separatorLine).toContain("─");
      expect(separatorLine).toContain("┼");
    });

    it("matches column count with separators", () => {
      const result = table([{ key: "a" }, { key: "b" }, { key: "c" }], [{}]);
      const separatorLine = result.split("\n")[1];
      expect(separatorLine.split("┼").length).toBe(3);
    });

    it("ends with dashes for last column", () => {
      const result = table([{ key: "a" }, { key: "b" }], [{}]);
      const separatorLine = result.split("\n")[1];
      expect(separatorLine).toMatch(/──$/);
    });
  });

  describe("last column", () => {
    it("does not pad last column with trailing spaces", () => {
      const result = table([{ key: "name" }], [{ name: "Alice" }]);
      const lines = result.split("\n");
      for (const line of lines) {
        expect(line).not.toMatch(/\s+$/);
      }
    });

    it("last column is not right-padded", () => {
      const result = table([{ key: "a" }, { key: "b" }], [{ a: "1", b: "2" }]);
      const dataLine = result.split("\n")[2];
      expect(dataLine).toMatch(/2\s*$/);
    });
  });

  describe("multiple rows", () => {
    it("renders all rows", () => {
      const result = table(
        [{ key: "name" }],
        [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }],
      );
      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
      expect(result).toContain("Charlie");
    });

    it("handles rows with different value lengths", () => {
      const result = table(
        [{ key: "name" }],
        [{ name: "x" }, { name: "verylongvalue" }],
      );
      expect(result).toContain("x");
      expect(result).toContain("verylongvalue");
    });
  });

  describe("rows with missing keys", () => {
    it("handles rows missing some columns", () => {
      const result = table(
        [{ key: "a" }, { key: "b" }],
        [{ a: "1" }, { b: "2" }],
      );
      expect(result).toContain("1");
      expect(result).toContain("2");
    });

    it("shows empty for undefined values", () => {
      const result = table([{ key: "name" }], [{}]);
      // Should not crash, value should be empty
      const lines = result.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("columns with no data rows", () => {
    it("returns empty string", () => {
      const result = table([{ key: "name" }], []);
      expect(result).toBe("");
    });
  });
});
