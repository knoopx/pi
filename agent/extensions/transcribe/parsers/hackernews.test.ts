import { describe, expect, it } from "vitest";
import { parser as hnParser } from "./hackernews";

describe("Hacker News parser", () => {
  describe("matches", () => {
    it.each([
      "https://news.ycombinator.com/",
      "https://news.ycombinator.com/item?id=12345",
      "https://news.ycombinator.com/newest",
      "https://news.ycombinator.com/best",
      "https://news.ycombinator.com/ask",
      "https://news.ycombinator.com/show",
      "https://news.ycombinator.com/jobs",
      "https://news.ycombinator.com/saved?id=user123",
      "https://news.ycombinator.com/upvoted?id=user123",
      "https://news.ycombinator.com/submitted?id=user456",
      "https://news.ycombinator.com/user?id=pg",
      "https://news.ycombinator.com/search?q=typescript",
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      "https://hacker-news.firebaseio.com/v0/item/12345.json",
    ])("matches %s", (url) => {
      expect(hnParser.matches(url)).toBe(true);
    });

    it.each([
      "https://hn.algolia.com/?q=test",
      "https://example.com/news.ycombinator.com/item",
    ])("does not match %s", (url) => {
      expect(hnParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domains", () => {
      expect(hnParser.matches("https://NEWS.YCOMBINATOR.COM/")).toBe(true);
      expect(
        hnParser.matches(
          "https://HACKER-NEWS.FIREBASEIO.COM/v0/topstories.json",
        ),
      ).toBe(true);
    });
  });

  describe("path types via matches", () => {
    it("matches frontpage", () => {
      expect(hnParser.matches("https://news.ycombinator.com/")).toBe(true);
      // Trailing slash is required by the regex
      expect(hnParser.matches("https://news.ycombinator.com")).toBe(false);
    });

    it("matches top stories path", () => {
      expect(hnParser.matches("https://news.ycombinator.com/")).toBe(true);
    });

    it("matches newest stories path", () => {
      expect(hnParser.matches("https://news.ycombinator.com/newest")).toBe(
        true,
      );
    });

    it("matches best stories path", () => {
      expect(hnParser.matches("https://news.ycombinator.com/best")).toBe(true);
    });

    it("matches ask HN path", () => {
      expect(hnParser.matches("https://news.ycombinator.com/ask")).toBe(true);
    });

    it("matches show HN path", () => {
      expect(hnParser.matches("https://news.ycombinator.com/show")).toBe(true);
    });

    it("matches jobs path", () => {
      expect(hnParser.matches("https://news.ycombinator.com/jobs")).toBe(true);
    });

    it("matches item URL with id param", () => {
      expect(
        hnParser.matches("https://news.ycombinator.com/item?id=39427851"),
      ).toBe(true);
    });

    it("matches user profile URL", () => {
      expect(hnParser.matches("https://news.ycombinator.com/user?id=pg")).toBe(
        true,
      );
    });

    it("matches saved stories URL", () => {
      expect(
        hnParser.matches("https://news.ycombinator.com/saved?id=patio11"),
      ).toBe(true);
    });

    it("matches upvoted stories URL", () => {
      expect(
        hnParser.matches("https://news.ycombinator.com/upvoted?id=user"),
      ).toBe(true);
    });

    it("matches submitted stories URL", () => {
      expect(
        hnParser.matches("https://news.ycombinator.com/submitted?id=patio11"),
      ).toBe(true);
    });

    it("matches search URL", () => {
      expect(
        hnParser.matches("https://news.ycombinator.com/search?q=typescript"),
      ).toBe(true);
      expect(
        hnParser.matches("https://news.ycombinator.com/?query=react"),
      ).toBe(true);
    });

    it("matches Firebase API URLs", () => {
      expect(
        hnParser.matches(
          "https://hacker-news.firebaseio.com/v0/topstories.json",
        ),
      ).toBe(true);
      expect(
        hnParser.matches(
          "https://hacker-news.firebaseio.com/v0/item/39427851.json",
        ),
      ).toBe(true);
      expect(
        hnParser.matches("https://hacker-news.firebaseio.com/v0/user/pg.json"),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles Firebase URLs with .json extension", () => {
      expect(
        hnParser.matches(
          "https://hacker-news.firebaseio.com/v0/newstories.json",
        ),
      ).toBe(true);
    });

    it("handles Firebase URLs without .json extension", () => {
      expect(
        hnParser.matches("https://hacker-news.firebaseio.com/v0/topstories"),
      ).toBe(true);
    });

    it("rejects Algolia search API URLs", () => {
      expect(hnParser.matches("https://hn.algolia.com/?q=test")).toBe(false);
    });
  });
});
