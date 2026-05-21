import { describe, it, expect } from "vitest";
import { parseYoutubeUrl } from "./url-parsing";

describe("parseYoutubeUrl", () => {
  it("parses standard watch URL", () => {
    const result = parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toEqual({ kind: "video", videoId: "dQw4w9WgXcQ" });
  });

  it("parses watch URL without www", () => {
    const result = parseYoutubeUrl("https://youtube.com/watch?v=abc123");
    expect(result).toEqual({ kind: "video", videoId: "abc123" });
  });

  it("parses embed URL", () => {
    const result = parseYoutubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result).toEqual({ kind: "video", videoId: "dQw4w9WgXcQ" });
  });

  it("parses shorts URL", () => {
    const result = parseYoutubeUrl("https://www.youtube.com/shorts/abc123");
    expect(result).toEqual({ kind: "video", videoId: "abc123" });
  });

  it("parses live URL", () => {
    const result = parseYoutubeUrl("https://www.youtube.com/live/xyz789");
    expect(result).toEqual({ kind: "video", videoId: "xyz789" });
  });

  it("parses playlist URL", () => {
    const result = parseYoutubeUrl(
      "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKmYsgNOknQgNkpFbS1uf",
    );
    expect(result).toEqual({
      kind: "playlist",
      playlistId: "PLrAXtmErZgOeiKmYsgNOknQgNkpFbS1uf",
    });
  });

  it("parses channel URL by ID", () => {
    const result = parseYoutubeUrl(
      "https://www.youtube.com/channel/UCxX9wtSTFWUZIznpwWv4F1A",
    );
    expect(result).toEqual({ kind: "channel", channelId: "UCxX9wtSTFWUZIznpwWv4F1A" });
  });

  it("parses channel /c/ URL", () => {
    const result = parseYoutubeUrl("https://www.youtube.com/c/MKBHD");
    expect(result).toEqual({ kind: "channel", channelId: "MKBHD" });
  });

  it("parses channel /user/ URL", () => {
    const result = parseYoutubeUrl("https://www.youtube.com/user/SomeChannel");
    expect(result).toEqual({ kind: "channel", channelId: "SomeChannel" });
  });

  it("parses @handle URL", () => {
    const result = parseYoutubeUrl("https://www.youtube.com/@veritasium");
    expect(result).toEqual({ kind: "channel", channelId: "@veritasium" });
  });

  it("parses search URL", () => {
    const result = parseYoutubeUrl(
      "https://www.youtube.com/results?search_query=typescript+tutorial",
    );
    expect(result).toEqual({
      kind: "search",
      query: "typescript tutorial",
    });
  });

  it("returns null for non-youtube URL", () => {
    expect(parseYoutubeUrl("https://www.vimeo.com/video/123")).toBeNull();
  });

  it("returns null for www.youtube without recognized path", () => {
    expect(parseYoutubeUrl("https://www.youtube.com/guide")).toBeNull();
  });

  it("handles watch with query params", () => {
    const result = parseYoutubeUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10&list=PLabc",
    );
    expect(result).toEqual({ kind: "video", videoId: "dQw4w9WgXcQ" });
  });
});
