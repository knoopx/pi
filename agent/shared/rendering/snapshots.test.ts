import { describe, expect, it } from "vitest";
import { table } from "./table/renderer";
import type { Column } from "./types";
import { dotJoin, stateDot } from "./labels";

describe("renderer snapshots", () => {
  describe("table", () => {
    it("renders a basic two-column table", () => {
      const cols: Column[] = [
        { key: "name" },
        { key: "score", align: "right" },
      ];
      const rows = [
        { name: "Alice", score: 100 },
        { name: "Bob", score: 42 },
        { name: "Charlie", score: 7 },
      ];
      expect(table(cols, rows)).toMatchSnapshot();
    });

    it("renders a table with format function and multi-line cells", () => {
      const cols: Column[] = [
        { key: "#", align: "right", minWidth: 3 },
        {
          key: "title",
          format: (_v, row) => {
            const r = row as { title: string; url: string };
            return `${r.title}\n${r.url}`;
          },
        },
      ];
      const rows = [
        { "#": "1", title: "Example", url: "https://example.com" },
        { "#": "2", title: "GitHub", url: "https://github.com" },
      ];
      expect(table(cols, rows)).toMatchSnapshot();
    });

    it("renders a table with indent", () => {
      const cols: Column[] = [{ key: "item" }, { key: "qty", align: "right" }];
      const rows = [
        { item: "Apples", qty: 5 },
        { item: "Bananas", qty: 12 },
      ];
      expect(table(cols, rows, { indent: 4 })).toMatchSnapshot();
    });

    it("renders empty table", () => {
      expect(table([{ key: "a" }], [])).toBe("");
    });
  });

  describe("dotJoin", () => {
    it("joins multiple segments", () => {
      expect(dotJoin("r/linux", "hot", "12 results")).toBe(
        "r/linux • hot • 12 results",
      );
    });

    it("handles single segment", () => {
      expect(dotJoin("only")).toBe("only");
    });
  });

  describe("stateDot", () => {
    it("renders all states", () => {
      expect(
        ["on", "off", "warning", "inactive"].map((s) =>
          stateDot(s as "on" | "off" | "warning" | "inactive"),
        ),
      ).toEqual(["●", "○", "●", "○"]);
    });

    it("accepts booleans", () => {
      expect(stateDot(true)).toBe("●");
      expect(stateDot(false)).toBe("○");
    });
  });
});
