import { describe, expect, it } from "vitest";
import { detail } from "./detail";

const ANSI_RE = /\x1b\[[0-9;]*m/g;
function strip(text: string): string {
  return text.replace(ANSI_RE, "");
}

describe("detail", () => {
  it("right-aligns labels to longest", () => {
    const out = strip(
      detail([
        { label: "a", value: "1" },
        { label: "long label", value: "2" },
      ]),
    );
    const lines = out.split("\n");
    // "a" should be padded to match "long label" width
    const pipePos0 = lines[0].indexOf("│");
    const pipePos1 = lines[1].indexOf("│");
    expect(pipePos0).toBe(pipePos1);
  });

  it("renders multi-line values with continuation", () => {
    const out = strip(
      detail([{ label: "desc", value: "line1\nline2\nline3" }]),
    );
    const lines = out.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("line1");
    expect(lines[1]).toContain("line2");
    expect(lines[2]).toContain("line3");
    // All lines should have │
    for (const line of lines) {
      expect(line).toContain("│");
    }
  });

  it("returns empty string for no fields", () => {
    expect(detail([])).toBe("");
  });
});
