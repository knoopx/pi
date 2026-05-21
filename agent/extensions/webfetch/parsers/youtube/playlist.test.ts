import { describe, it, expect, vi, beforeEach } from "vitest";
import * as clientModule from "./client";

vi.mock("./client", () => ({
  fetchYoutube: vi.fn(),
}));

function createPlaylistMock() {
  return vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("playlists?"))
      return { items: [{ snippet: { title: "My Playlist" } }] };
    return { items: [] };
  });
}

describe("handlePlaylist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes playlist title", async () => {
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockImplementation(
      createPlaylistMock(),
    );
    const { handlePlaylist } = await import("./playlist");
    const result = await handlePlaylist("PLabc123");
    expect(result).toContain("My Playlist");
  });

  it("includes playlist link", async () => {
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockImplementation(
      createPlaylistMock(),
    );
    const { handlePlaylist } = await import("./playlist");
    const result = await handlePlaylist("PLabc123");
    expect(result).toContain("https://www.youtube.com/playlist?list=PLabc123");
  });

  it("throws when playlist not found", async () => {
    (clientModule.fetchYoutube as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
    });
    const { handlePlaylist } = await import("./playlist");
    await expect(handlePlaylist("nonexistent")).rejects.toThrow("not found");
  });
});
