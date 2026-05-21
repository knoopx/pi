import { describe, it, expect, vi, beforeEach } from "vitest";
import * as clientModule from "./client";

vi.mock("./client", () => ({
  fetchYoutube: vi.fn(),
}));

function makeSearchData(): Record<string, unknown> {
  return {
    items: [
      {
        id: { videoId: "video1" },
        snippet: {
          title: "First Result",
          channelTitle: "Channel A",
          publishedAt: "2024-01-15T10:00:00Z",
        },
      },
      {
        id: { videoId: "video2" },
        snippet: {
          title: "Second Result",
          channelTitle: "Channel B",
          publishedAt: "2024-01-16T10:00:00Z",
        },
      },
    ],
  };
}

describe("handleSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url.includes("search?")) return makeSearchData();
        return { items: [] };
      },
    );
  });

  it("includes search results", async () => {
    const { handleSearch } = await import("./search");
    const result = await handleSearch("typescript tutorial");
    expect(result).toContain("First Result");
  });

  it("includes channel info", async () => {
    const { handleSearch } = await import("./search");
    const result = await handleSearch("typescript tutorial");
    expect(result).toContain("Channel A");
  });

  it("includes watch links", async () => {
    const { handleSearch } = await import("./search");
    const result = await handleSearch("typescript tutorial");
    expect(result).toContain("https://www.youtube.com/watch?v=video1");
  });

  it("handles empty results", async () => {
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
    });
    const { handleSearch } = await import("./search");
    const result = await handleSearch("nonexistent query");
    expect(result).toContain("0 result(s)");
  });
});
