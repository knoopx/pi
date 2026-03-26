/**
 * Snapshot tests for renderer output patterns.
 *
 * Locks down the exact visual format of table, detail, header, and action renderers
 * so layout regressions are caught immediately.
 */

import { describe, expect, it } from "vitest";
import { table, type Column } from "./table";
import { detail } from "./detail";
import { dotJoin, sectionDivider, threadSeparator, stateDot } from "./header";
import { actionLine } from "./action";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

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
      expect(stripAnsi(table(cols, rows))).toMatchSnapshot();
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
      expect(stripAnsi(table(cols, rows))).toMatchSnapshot();
    });

    it("renders a table with indent", () => {
      const cols: Column[] = [{ key: "item" }, { key: "qty", align: "right" }];
      const rows = [
        { item: "Apples", qty: 5 },
        { item: "Bananas", qty: 12 },
      ];
      expect(stripAnsi(table(cols, rows, { indent: 4 }))).toMatchSnapshot();
    });

    it("renders empty table", () => {
      expect(table([{ key: "a" }], [])).toBe("");
    });
  });

  describe("detail", () => {
    it("renders key-value pairs with right-aligned labels", () => {
      expect(
        stripAnsi(
          detail([
            { label: "name", value: "express" },
            { label: "version", value: "5.2.1" },
            { label: "license", value: "MIT" },
            { label: "description", value: "Fast web framework" },
          ]),
        ),
      ).toMatchSnapshot();
    });

    it("renders multi-line values", () => {
      expect(
        stripAnsi(
          detail([
            { label: "tags", value: "web\nhttp\nserver\nframework" },
            { label: "author", value: "TJ Holowaychuk" },
          ]),
        ),
      ).toMatchSnapshot();
    });

    it("renders empty fields", () => {
      expect(detail([])).toBe("");
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

  describe("sectionDivider", () => {
    it("renders plain rule", () => {
      expect(sectionDivider()).toMatchSnapshot();
    });

    it("renders labeled divider", () => {
      expect(sectionDivider("Quant Files (25)")).toMatchSnapshot();
    });
  });

  describe("threadSeparator", () => {
    it("renders author and date", () => {
      expect(threadSeparator("alice", "2026-03-05")).toMatchSnapshot();
    });

    it("renders with suffix", () => {
      expect(
        threadSeparator("bob", "2026-03-06", "status → closed"),
      ).toMatchSnapshot();
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

  describe("actionLine", () => {
    it("renders action only", () => {
      expect(actionLine("Task created")).toBe("Task created");
    });

    it("renders action with detail", () => {
      expect(actionLine("Toggled light.living_room", "● on → ● off")).toBe(
        "Toggled light.living_room • ● on → ● off",
      );
    });
  });
});
