import { describe, it, expect } from "vitest";
import { stripAnsi, dedupLines, truncateLines, formatOutput } from "./helpers";

describe("stripAnsi", () => {
  it("removes SGR sequences", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m text")).toBe("red text");
  });
  it("passes through ansi-free text", () => {
    expect(stripAnsi("hello")).toBe("hello");
  });
});

describe("dedupLines", () => {
  it("collapses consecutive duplicates", () => {
    const out = dedupLines(["a", "b", "b", "b", "c"]);
    expect(out).toEqual([
      "a",
      "b",
      "  [... 2 duplicate line(s) collapsed ...]",
      "c",
    ]);
  });
  it("handles trailing duplicates", () => {
    const out = dedupLines(["a", "a", "a"]);
    expect(out).toEqual(["a", "  [... 2 duplicate line(s) collapsed ...]"]);
  });
});

describe("truncateLines", () => {
  it("passes through short output", () => {
    const { lines, truncated } = truncateLines(["a", "b"], 10);
    expect(lines).toEqual(["a", "b"]);
    expect(truncated).toBe(false);
  });
  it("truncates long output with head/tail", () => {
    const input = Array.from({ length: 20 }, (_, i) => `line${i}`);
    const { lines, truncated } = truncateLines(input, 8);
    expect(truncated).toBe(true);
    // cap=8 → head=4, tail=2, skipped=14
    expect(lines.length).toBe(4 + 1 + 2);
    expect(lines[0]).toBe("line0");
    expect(lines[4]).toContain("lines truncated");
  });
});

describe("formatOutput", () => {
  it("formats basic exit=0 output", () => {
    const out = formatOutput(
      "hello\nworld\n",
      0,
      "/tmp",
      false,
      "backend=subprocess",
    );
    expect(out).toContain("hello");
    expect(out).toContain("world");
    expect(out).toContain(
      "[exit=0 cwd=/tmp timed_out=false backend=subprocess]",
    );
  });
  it("emits footer only for empty body", () => {
    const out = formatOutput("", 0, "/tmp", false, "");
    expect(out.startsWith("[")).toBe(true);
  });
  it("appends output_truncated when head/tail cut", () => {
    const big = Array.from({ length: 500 }, (_, i) => `line${i}`).join("\n");
    const out = formatOutput(big, 0, "/", false, "");
    expect(out).toContain("output_truncated=true");
  });
  it("strips ANSI before line processing", () => {
    const out = formatOutput("\x1b[32mgreen\x1b[0m", 0, "/", false, "");
    expect(out).toContain("green");
    expect(out).not.toContain("\x1b");
  });
});
