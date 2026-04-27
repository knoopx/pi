import { describe, expect, it } from "vitest";
import { parser as redditParser } from "./reddit";

describe("Reddit parser", () => {
  describe("matches", () => {
    it.each([
      "https://www.reddit.com/r/programming/",
      "https://old.reddit.com/r/javascript/hot",
      "https://reddit.com/r/typescript/top?t=week",
      "https://www.reddit.com/r/AskLinux/comments/abc123/",
      "https://www.reddit.com/user/spez/",
      "https://www.reddit.com/user/spez/submitted/",
      "https://reddit.com/",
      "https://www.reddit.com/search/?q=typescript",
    ])("matches %s", (url) => {
      expect(redditParser.matches(url)).toBe(true);
    });

    it.each([
      "https://redditnews.com/test",
      "https://www.redd.it/abc123",
      "https://example.com/reddit/post",
    ])("does not match %s", (url) => {
      expect(redditParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(redditParser.matches("https://WWW.REDDIT.COM/r/programming")).toBe(
        true,
      );
      expect(redditParser.matches("https://OLD.Reddit.com/r/javascript")).toBe(
        true,
      );
    });

    it("handles www and non-www variants", () => {
      expect(redditParser.matches("https://www.reddit.com/r/test")).toBe(true);
      expect(redditParser.matches("https://reddit.com/r/test")).toBe(true);
    });
  });

  describe("path types via matches", () => {
    it("matches subreddit URL", () => {
      expect(
        redditParser.matches("https://www.reddit.com/r/programming/"),
      ).toBe(true);
    });

    it("matches subreddit with sort", () => {
      expect(
        redditParser.matches("https://www.reddit.com/r/javascript/hot"),
      ).toBe(true);
      expect(redditParser.matches("https://www.reddit.com/r/python/top")).toBe(
        true,
      );
    });

    it("matches comment thread URL", () => {
      expect(
        redditParser.matches(
          "https://www.reddit.com/r/programming/comments/abc123/hello_world/",
        ),
      ).toBe(true);
    });

    it("matches user URL", () => {
      expect(redditParser.matches("https://www.reddit.com/user/spez")).toBe(
        true,
      );
    });

    it("matches old.reddit.com URLs", () => {
      expect(redditParser.matches("https://old.reddit.com/r/test")).toBe(true);
    });

    it("matches frontpage", () => {
      expect(redditParser.matches("https://www.reddit.com/")).toBe(true);
      // Trailing slash is required by the regex
      expect(redditParser.matches("https://reddit.com/")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles URLs with time filter", () => {
      expect(
        redditParser.matches("https://www.reddit.com/r/programming/top?t=year"),
      ).toBe(true);
    });

    it("handles trailing slashes", () => {
      expect(redditParser.matches("https://www.reddit.com/")).toBe(true);
      expect(redditParser.matches("https://www.reddit.com/r/test/")).toBe(true);
    });

    it("rejects redd.it short links", () => {
      expect(redditParser.matches("https://www.redd.it/abc123")).toBe(false);
    });
  });
});
