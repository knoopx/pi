import { describe, it, expect } from "vitest";
import { formatSimpleOutput, formatAggregateOutput } from "./index";
import type { AgentRunStats } from "./index";
import { createUsage } from "./test/utils";

function createStats(overrides: Partial<AgentRunStats> = {}): AgentRunStats {
  return {
    turns: 1,
    totalOutputTokens: 0,
    totalInputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalTokens: 0,
    totalCost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
      ...(overrides.totalCost ?? {}),
    },
    totalGenerationMs: 0,
    ...overrides,
  };
}

describe("turn-stats per-turn output", () => {
  it("renders per-turn stats with cost", () => {
    const usage = createUsage({ cost: { total: 0.12 } });
    const line = formatSimpleOutput(1924, 36000, usage, 36750);
    expect(line).toMatchSnapshot();
  });

  it("renders per-turn stats without cost (below threshold)", () => {
    const usage = createUsage({ cost: { total: 0.001 } });
    const line = formatSimpleOutput(500, 5000, usage, 4500);
    expect(line).toMatchSnapshot();
  });

  it("renders per-turn stats with large token count", () => {
    const usage = createUsage({ cost: { total: 1.5 } });
    const line = formatSimpleOutput(125000, 135000, usage, 240000);
    expect(line).toMatchSnapshot();
  });

  it("renders per-turn stats with N/A output", () => {
    const line = formatSimpleOutput(undefined, 2000, undefined);
    expect(line).toMatchSnapshot();
  });
});

describe("turn-stats aggregate output", () => {
  it("renders end-of-run aggregate with all fields", () => {
    const stats = createStats({
      turns: 5,
      totalInputTokens: 12400,
      totalOutputTokens: 45200,
      totalCost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0.28,
      },
      totalGenerationMs: 1320000,
    });
    const line = formatAggregateOutput(stats, 135000);
    expect(line).toMatchSnapshot();
  });

  it("renders end-of-run aggregate single turn", () => {
    const stats = createStats({
      turns: 1,
      totalInputTokens: 2400,
      totalOutputTokens: 890,
      totalCost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0.03,
      },
      totalGenerationMs: 12000,
    });
    const line = formatAggregateOutput(stats, 15000);
    expect(line).toMatchSnapshot();
  });

  it("renders end-of-run aggregate without cost", () => {
    const stats = createStats({
      turns: 3,
      totalInputTokens: 800,
      totalOutputTokens: 200,
      totalCost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0.002,
      },
      totalGenerationMs: 5000,
    });
    const line = formatAggregateOutput(stats, 8000);
    expect(line).toMatchSnapshot();
  });

  it("renders end-of-run aggregate with long duration", () => {
    const stats = createStats({
      turns: 12,
      totalInputTokens: 500000,
      totalOutputTokens: 1200000,
      totalCost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 8.45,
      },
      totalGenerationMs: 3600000,
    });
    const line = formatAggregateOutput(stats, 7200000);
    expect(line).toMatchSnapshot();
  });
});
