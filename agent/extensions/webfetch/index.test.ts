import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMockExtensionAPI } from "../../shared/testing/test-factories";
import type { MockExtensionAPI } from "../../shared/testing/test-factories";

function getWebFetchTool(mockPi: MockExtensionAPI) {
  const calls = mockPi.registerTool.mock.calls as [unknown][];
  return calls.find(
    (c) =>
      typeof c[0] === "object" &&
      (c[0] as { name?: string }).name === "web-fetch",
  )![0] as {
    name: string;
    label?: string;
    execute: (id: string, params: unknown) => Promise<unknown>;
  };
}

describe("webfetch extension", () => {
  let mockPi: MockExtensionAPI;
  let mockGetCached: ReturnType<typeof vi.fn>;
  let mockSetCached: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockGetCached = vi.fn().mockResolvedValue(null);
    mockSetCached = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./lib/registry", () => ({
      parse: vi.fn().mockResolvedValue("# Result"),
    }));
    vi.doMock("./lib/cache", () => ({
      getCached: mockGetCached,
      setCached: mockSetCached,
    }));
    mockPi = createMockExtensionAPI();
    const mod = await import("./index");
    (mod.default as (pi: ExtensionAPI) => void)(
      mockPi as unknown as ExtensionAPI,
    );
  });

  it("registers the web-fetch tool", () => {
    const calls = mockPi.registerTool.mock.calls as [unknown][];
    expect(
      calls.some(
        (c) =>
          typeof c[0] === "object" &&
          (c[0] as { name?: string }).name === "web-fetch",
      ),
    ).toBe(true);
  });

  it("registers tool with correct name and label", () => {
    const tool = getWebFetchTool(mockPi);
    expect(tool.name).toBe("web-fetch");
    expect(tool.label).toBeDefined();
  });

  describe("execute", () => {
    it("returns cached result when available", async () => {
      mockGetCached.mockResolvedValue("cached content");

      const tool = getWebFetchTool(mockPi);
      const result = await tool.execute("id", {
        source: "https://example.com",
      });
      expect((result as { details: { cached: boolean } }).details.cached).toBe(
        true,
      );
    });

    it("returns parsed result when not cached", async () => {
      const tool = getWebFetchTool(mockPi);
      // Should not crash
      await tool.execute("id", { source: "https://example.com" });
    });
  });
});
