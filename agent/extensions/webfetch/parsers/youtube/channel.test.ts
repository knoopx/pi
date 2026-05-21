import { describe, it, expect, vi, beforeEach } from "vitest";
import * as clientModule from "./client";

vi.mock("./client", () => ({
  fetchYoutube: vi.fn(),
}));

function makeChannelData(): Record<string, unknown> {
  return {
    items: [
      {
        snippet: {
          title: "Test Channel",
          description: "A test channel",
          customUrl: "@testchannel",
          publishedAt: "2020-01-15T10:00:00Z",
          thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
        },
        statistics: {
          subscriberCount: "100000",
          videoCount: "500",
          viewCount: "10000000",
        },
      },
    ],
  };
}

describe("handleChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url.includes("channels?")) return makeChannelData();
        return { items: [] };
      },
    );
  });

  it("includes channel title", async () => {
    const { handleChannel } = await import("./channel");
    const result = await handleChannel("UC123");
    expect(result).toContain("Test Channel");
  });

  it("includes custom URL", async () => {
    const { handleChannel } = await import("./channel");
    const result = await handleChannel("UC123");
    expect(result).toContain("joined:");
  });

  it("includes subscriber count", async () => {
    const { handleChannel } = await import("./channel");
    const result = await handleChannel("UC123");
    expect(result).toContain("subscribers:");
  });

  it("includes video count", async () => {
    const { handleChannel } = await import("./channel");
    const result = await handleChannel("UC123");
    expect(result).toContain("videos:");
  });

  it("includes view count", async () => {
    const { handleChannel } = await import("./channel");
    const result = await handleChannel("UC123");
    expect(result).toContain("views:");
  });

  it("throws when channel not found", async () => {
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
    });
    const { handleChannel } = await import("./channel");
    await expect(handleChannel("nonexistent")).rejects.toThrow("not found");
  });
});
