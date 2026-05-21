import { describe, it, expect } from "vitest";
import { parseLine, PATTERNS } from "./index";

describe("parseLine", () => {
  it("returns 0 on proxying line", () => {
    expect(
      parseLine(
        "proxying request to model localweights/Qwen3.6-27B on port 59795",
        null,
      ),
    ).toBe(0);
  });

  it("parses progress from log line", () => {
    expect(
      parseLine("prompt processing, n_tokens = 5452, progress = 0.99", 0),
    ).toBeCloseTo(0.99);
  });

  it("parses progress at 1.00", () => {
    expect(parseLine("progress = 1.00, t = 4.19 s", 0.5)).toBeCloseTo(1.0);
  });

  it("ignores unrelated lines", () => {
    expect(parseLine("some checkpoint line", 0.5)).toBe(0.5);
  });

  it("full cycle", () => {
    const lines = [
      "proxying request to model localweights/Qwen3.6-27B on port 59795",
      "prompt processing, n_tokens = 1000, progress = 0.25",
      "prompt processing, n_tokens = 3000, progress = 0.75",
      "prompt processing, n_tokens = 4000, progress = 1.00",
    ];

    let p: number | null = null;
    const results: (number | null)[] = [];
    for (const line of lines) {
      p = parseLine(line, p);
      results.push(p);
    }

    expect(results).toMatchSnapshot();
  });
});

describe("widget render output", () => {
  function buildRender(progress: number | null): string[] {
    if (progress === null) return [];
    const barLen = 20;
    const filled = Math.max(1, Math.round(progress * barLen));
    const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
    return [bar];
  }

  it("renders nothing when null", () => {
    expect(buildRender(null)).toMatchSnapshot();
  });

  it("renders progress bar at 0%", () => {
    expect(buildRender(0)).toMatchSnapshot();
  });

  it("renders progress bar at 25%", () => {
    expect(buildRender(0.25)).toMatchSnapshot();
  });

  it("renders progress bar at 50%", () => {
    expect(buildRender(0.5)).toMatchSnapshot();
  });

  it("renders progress bar at 99%", () => {
    expect(buildRender(0.99)).toMatchSnapshot();
  });

  it("renders progress bar at 100%", () => {
    expect(buildRender(1.0)).toMatchSnapshot();
  });
});

describe("PATTERNS", () => {
  it("matches proxying line", () => {
    expect(
      PATTERNS.proxying.test(
        "proxying request to model localweights/Qwen on port 59795",
      ),
    ).toBe(true);
  });

  it("matches progress line", () => {
    expect(PATTERNS.progress.test("progress = 0.99")).toBe(true);
  });
});
