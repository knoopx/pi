import { describe, it, expect, vi, beforeEach } from "vitest";
import * as clientModule from "./client";

vi.mock("./client", () => ({
  fetchYoutube: vi.fn(),
}));

function makeVideoData(): Record<string, unknown> {
  return {
    items: [
      {
        snippet: {
          title: "Test Video",
          channelTitle: "Test Channel",
          channelId: "UC123",
          publishedAt: "2024-01-15T10:00:00Z",
          description: "A test video description",
        },
        contentDetails: {
          duration: "PT5M30S",
          definition: "hd",
          caption: true,
        },
        statistics: {
          viewCount: "1000000",
          likeCount: "50000",
        },
      },
    ],
  };
}

function makeCommentsData(): Record<string, unknown> {
  return {
    items: [
      {
        snippet: {
          topLevelComment: {
            snippet: {
              authorDisplayName: "user123",
              likeCount: 42,
              textDisplay: "Great video!",
            },
          },
        },
      },
    ],
  };
}

describe("handleVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url.includes("videos?")) return makeVideoData();
        return makeCommentsData();
      },
    );
  });

  it("includes video title", async () => {
    const { handleVideo } = await import("./video");
    const result = await handleVideo("dQw4w9WgXcQ");
    expect(result).toContain("Test Video");
  });

  it("includes channel info", async () => {
    const { handleVideo } = await import("./video");
    const result = await handleVideo("dQw4w9WgXcQ");
    expect(result).toContain("Test Channel");
  });

  it("includes duration in human format", async () => {
    const { handleVideo } = await import("./video");
    const result = await handleVideo("dQw4w9WgXcQ");
    expect(result).toContain("5m 30s");
  });

  it("includes view and like counts", async () => {
    const { handleVideo } = await import("./video");
    const result = await handleVideo("dQw4w9WgXcQ");
    expect(result).toMatch(/1.*000.*000 views/);
    expect(result).toMatch(/5.*0.*0.*0 likes/);
  });

  it("includes watch link", async () => {
    const { handleVideo } = await import("./video");
    const result = await handleVideo("dQw4w9WgXcQ");
    expect(result).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("includes description", async () => {
    const { handleVideo } = await import("./video");
    const result = await handleVideo("dQw4w9WgXcQ");
    expect(result).toContain("A test video description");
  });

  it("handles missing comments gracefully", async () => {
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url.includes("videos?")) return makeVideoData();
        throw new Error("API error");
      },
    );
    const { handleVideo } = await import("./video");
    const result = await handleVideo("dQw4w9WgXcQ");
    expect(result).toContain("Test Video");
  });

  it("throws when video not found", async () => {
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockImplementation(
      async (_url: string) => ({ items: [] }),
    );
    const { handleVideo } = await import("./video");
    await expect(handleVideo("nonexistent")).rejects.toThrow("not found");
  });
});
