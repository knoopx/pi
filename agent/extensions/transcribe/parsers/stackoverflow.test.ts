import { describe, expect, it } from "vitest";
import { parser as soParser } from "./stackoverflow";

describe("Stack Overflow parser", () => {
  describe("matches", () => {
    it.each([
      "https://stackoverflow.com/questions/12345",
      "https://www.stackoverflow.com/questions/tagged/typescript",
      "https://stackoverflow.com/search?q=typescript+async",
      "https://stackoverflow.com/questions/67890/some-title",
      "http://stackoverflow.com/users/123/john-doe",
    ])("matches %s", (url) => {
      expect(soParser.matches(url)).toBe(true);
    });

    it.each([
      "https://meta.stackoverflow.com/questions/test",
      "https://stackoverflow.co/test",
      "https://example.com/stackoverflow/question",
    ])("does not match %s", (url) => {
      expect(soParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(soParser.matches("https://STACKOVERFLOW.COM/questions/123")).toBe(
        true,
      );
    });

    it("handles www and non-www variants", () => {
      expect(
        soParser.matches("https://www.stackoverflow.com/questions/1"),
      ).toBe(true);
      expect(soParser.matches("https://stackoverflow.com/questions/1")).toBe(
        true,
      );
    });
  });

  describe("path types via matches", () => {
    it("matches question ID URL", () => {
      expect(
        soParser.matches("https://stackoverflow.com/questions/12345"),
      ).toBe(true);
      expect(
        soParser.matches(
          "https://stackoverflow.com/questions/67890/title-here",
        ),
      ).toBe(true);
    });

    it("matches tagged questions URL", () => {
      expect(
        soParser.matches("https://stackoverflow.com/questions/tagged/python"),
      ).toBe(true);
      expect(
        soParser.matches(
          "https://stackoverflow.com/questions/tagged/javascript?tab=newest",
        ),
      ).toBe(true);
    });

    it("matches search URL", () => {
      expect(
        soParser.matches(
          "https://stackoverflow.com/search?q=typescript+errors",
        ),
      ).toBe(true);
      expect(
        soParser.matches(
          "https://stackoverflow.com/search?q=react&tab=relevance",
        ),
      ).toBe(true);
    });

    it("matches users path", () => {
      expect(soParser.matches("https://stackoverflow.com/users/123/john")).toBe(
        true,
      );
    });

    it("matches frontpage (latest questions)", () => {
      expect(soParser.matches("https://stackoverflow.com/")).toBe(true);
      // Trailing slash is required by the regex
      expect(soParser.matches("https://stackoverflow.com")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles numeric-only question IDs", () => {
      expect(soParser.matches("https://stackoverflow.com/questions/1")).toBe(
        true,
      );
    });

    it("handles URLs with title slug", () => {
      expect(
        soParser.matches(
          "https://stackoverflow.com/questions/42/how-do-i-write-a-unit-test",
        ),
      ).toBe(true);
    });

    it("handles search with sort tabs", () => {
      expect(
        soParser.matches("https://stackoverflow.com/search?q=test&tab=votes"),
      ).toBe(true);
      expect(
        soParser.matches("https://stackoverflow.com/search?q=test&tab=newest"),
      ).toBe(true);
    });
  });
});
