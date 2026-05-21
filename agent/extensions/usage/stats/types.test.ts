import { describe, it, expect } from "vitest";
import {
  emptyModelStats,
  emptyProviderStats,
  emptyTimeFilteredStats,
  accumulateStats,
} from "./types";

describe("emptyModelStats", () => {
  it("creates model stats with zero values", () => {
    const stats = emptyModelStats();
    expect(stats.messages).toBe(0);
    expect(stats.cost).toBe(0);
    expect(stats.tokens.total).toBe(0);
    expect(stats.tokens.input).toBe(0);
    expect(stats.tokens.output).toBe(0);
    expect(stats.tokens.cache).toBe(0);
  });

  it("creates a new set for sessions", () => {
    const stats = emptyModelStats();
    expect(stats.sessions.size).toBe(0);
    stats.sessions.add("session-1");
    expect(stats.sessions.has("session-1")).toBe(true);
  });
});

describe("emptyProviderStats", () => {
  it("creates provider stats with zero values and empty collections", () => {
    const stats = emptyProviderStats();
    expect(stats.messages).toBe(0);
    expect(stats.cost).toBe(0);
    expect(stats.sessions.size).toBe(0);
    expect(stats.models.size).toBe(0);
  });

  it("creates a new map for models", () => {
    const stats = emptyProviderStats();
    expect(stats.models.size).toBe(0);
  });
});

describe("emptyTimeFilteredStats", () => {
  it("creates stats with empty providers map and zero totals", () => {
    const stats = emptyTimeFilteredStats();
    expect(stats.providers.size).toBe(0);
    expect(stats.totals.sessions).toBe(0);
    expect(stats.totals.messages).toBe(0);
    expect(stats.totals.cost).toBe(0);
  });
});

describe("accumulateStats", () => {
  it("increments message count", () => {
    const stats = emptyModelStats();
    accumulateStats(stats, 0.001, { total: 100, input: 50, output: 50, cache: 0 });
    expect(stats.messages).toBe(1);
    accumulateStats(stats, 0.002, { total: 200, input: 100, output: 100, cache: 0 });
    expect(stats.messages).toBe(2);
  });

  it("accumulates cost", () => {
    const stats = emptyModelStats();
    accumulateStats(stats, 0.003, { total: 100, input: 50, output: 50, cache: 0 });
    accumulateStats(stats, 0.004, { total: 200, input: 100, output: 100, cache: 0 });
    expect(stats.cost).toBeCloseTo(0.007);
  });

  it("accumulates token counts", () => {
    const stats = emptyModelStats();
    accumulateStats(stats, 0.001, { total: 100, input: 50, output: 40, cache: 10 });
    expect(stats.tokens.total).toBe(100);
    expect(stats.tokens.input).toBe(50);
    expect(stats.tokens.output).toBe(40);
    expect(stats.tokens.cache).toBe(10);
  });

  it("accumulates across multiple calls", () => {
    const stats = emptyModelStats();
    accumulateStats(stats, 0.001, { total: 100, input: 50, output: 40, cache: 10 });
    accumulateStats(stats, 0.002, { total: 200, input: 100, output: 80, cache: 20 });
    expect(stats.tokens.total).toBe(300);
    expect(stats.tokens.input).toBe(150);
    expect(stats.tokens.output).toBe(120);
    expect(stats.tokens.cache).toBe(30);
  });

  it("handles zero tokens", () => {
    const stats = emptyModelStats();
    accumulateStats(stats, 0.001, { total: 0, input: 0, output: 0, cache: 0 });
    expect(stats.tokens.total).toBe(0);
  });
});
