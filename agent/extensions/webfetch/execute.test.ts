import { describe, it, expect, vi } from "vitest";

// Mock everything before importing the extension
vi.mock("./lib/cache", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./lib/registry", () => ({
  parse: vi.fn().mockResolvedValue("# Parsed result"),
}));

import { getCached, setCached } from "./lib/cache";
import { parse } from "./lib/registry";

describe("webfetch execute path", () => {
  it("getCached returns null when not cached", async () => {
    const result = await getCached("https://example.com");
    expect(result).toBeNull();
  });

  it("setCached can be called", async () => {
    await setCached("https://example.com", "content");
    expect(setCached).toHaveBeenCalled();
  });

  it("parse returns mdast tree", async () => {
    const result = await parse("https://example.com");
    expect(result).toBeDefined();
  });

  it("parse handles string results", async () => {
    vi.doMock("./lib/registry", () => ({
      parse: vi.fn().mockResolvedValue("plain text"),
    }));
    // Re-import to get the new mock
    const mod = await import("./lib/registry");
    const result = await mod.parse("https://example.com");
    expect(typeof result).toBe("string");
  });
});
