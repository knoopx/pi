import { beforeAll, describe, expect, it } from "vitest";
import { youtubeParser } from "./youtube";
import { parse } from "../lib/registry";

describe("YouTube parser", () => {
  describe("matches", () => {
    it.each([
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=abc123",
      "http://youtube.com/shorts/xyz789",
      "https://www.youtube.com/embed/abc123",
      "https://www.youtube.com/live/abc123",
      "https://www.youtube.com/playlist?list=PLtest",
      "https://www.youtube.com/channel/UCtest",
      "https://www.youtube.com/c/CustomName",
      "https://www.youtube.com/@Handle",
      "https://www.youtube.com/user/SomeUser",
      "https://www.youtube.com/search?q=test+query",
    ])("matches %s", (url) => {
      expect(youtubeParser.matches(url)).toBe(true);
    });

    it.each([
      "https://youtu.be/abc123",
      "https://music.youtube.com/watch?v=abc123",
      "https://example.com/youtube.com/watch?v=test",
      "https://youtube.dcom/watch?v=test",
    ])("does not match %s", (url) => {
      expect(youtubeParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(youtubeParser.matches("https://YOUTUBE.COM/watch?v=test")).toBe(
        true,
      );
      expect(
        youtubeParser.matches("https://WWW.YOUTUBE.COM/watch?v=test"),
      ).toBe(true);
    });
  });

  describe("path parsing", () => {
    it("recognizes /watch URLs", () => {
      expect(youtubeParser.matches("https://youtube.com/watch?v=abc123")).toBe(
        true,
      );
    });

    it("recognizes /embed/ URLs", () => {
      expect(youtubeParser.matches("https://youtube.com/embed/abc123")).toBe(
        true,
      );
    });

    it("recognizes /shorts/ URLs", () => {
      expect(youtubeParser.matches("https://youtube.com/shorts/xyz789")).toBe(
        true,
      );
    });

    it("recognizes /playlist/ URLs", () => {
      expect(
        youtubeParser.matches("https://youtube.com/playlist?list=PLtest"),
      ).toBe(true);
    });

    it("recognizes /channel/ URLs", () => {
      expect(youtubeParser.matches("https://youtube.com/channel/UCtest")).toBe(
        true,
      );
    });

    it("recognizes /@handle URLs", () => {
      expect(youtubeParser.matches("https://youtube.com/@Handle")).toBe(true);
    });

    it("recognizes /search URLs", () => {
      expect(youtubeParser.matches("https://youtube.com/search?q=test")).toBe(
        true,
      );
    });

    it("recognizes custom channel URLs", () => {
      expect(youtubeParser.matches("https://youtube.com/c/CustomName")).toBe(
        true,
      );
    });
  });
});
