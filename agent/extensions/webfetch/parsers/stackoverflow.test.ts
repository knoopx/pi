import { beforeAll, describe, expect, it } from "vitest";
import { stackoverflowParser } from "./stackoverflow";
import { parse } from "../lib/registry";

describe("Stack Overflow parser", () => {
  describe("matches", () => {
    it.each([
      "https://stackoverflow.com/questions/12345",
      "https://www.stackoverflow.com/questions/tagged/typescript",
      "https://stackoverflow.com/search?q=typescript+async",
      "https://stackoverflow.com/questions/67890/some-title",
      "http://stackoverflow.com/users/123/john-doe",
    ])("matches %s", (url) => {
      expect(stackoverflowParser.matches(url)).toBe(true);
    });

    it.each([
      "https://meta.stackoverflow.com/questions/test",
      "https://stackoverflow.co/test",
      "https://example.com/stackoverflow/question",
    ])("does not match %s", (url) => {
      expect(stackoverflowParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(
        stackoverflowParser.matches("https://STACKOVERFLOW.COM/questions/123"),
      ).toBe(true);
    });

    it("handles www and non-www variants", () => {
      expect(
        stackoverflowParser.matches(
          "https://www.stackoverflow.com/questions/1",
        ),
      ).toBe(true);
      expect(
        stackoverflowParser.matches("https://stackoverflow.com/questions/1"),
      ).toBe(true);
    });
  });

  describe("path types via matches", () => {
    it("matches question ID URL", () => {
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/questions/12345",
        ),
      ).toBe(true);
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/questions/67890/title-here",
        ),
      ).toBe(true);
    });

    it("matches tagged questions URL", () => {
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/questions/tagged/python",
        ),
      ).toBe(true);
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/questions/tagged/javascript?tab=newest",
        ),
      ).toBe(true);
    });

    it("matches search URL", () => {
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/search?q=typescript+errors",
        ),
      ).toBe(true);
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/search?q=react&tab=relevance",
        ),
      ).toBe(true);
    });

    it("matches users path", () => {
      expect(
        stackoverflowParser.matches("https://stackoverflow.com/users/123/john"),
      ).toBe(true);
    });

    it("matches frontpage (latest questions)", () => {
      expect(stackoverflowParser.matches("https://stackoverflow.com/")).toBe(
        true,
      );
      expect(stackoverflowParser.matches("https://stackoverflow.com")).toBe(
        false,
      );
    });
  });

  describe("edge cases", () => {
    it("handles numeric-only question IDs", () => {
      expect(
        stackoverflowParser.matches("https://stackoverflow.com/questions/1"),
      ).toBe(true);
    });

    it("handles URLs with title slug", () => {
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/questions/42/how-do-i-write-a-unit-test",
        ),
      ).toBe(true);
    });

    it("handles search with sort tabs", () => {
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/search?q=test&tab=votes",
        ),
      ).toBe(true);
      expect(
        stackoverflowParser.matches(
          "https://stackoverflow.com/search?q=test&tab=newest",
        ),
      ).toBe(true);
    });
  });

  describe("snapshot", () => {
    beforeAll(async () => {
      const { mockFetchWithFixtures } = await import("../test/utils");
      mockFetchWithFixtures();
    });
    it("captures output for https://stackoverflow.com/questions/79935417", async () => {
      const result = await parse(
        "https://stackoverflow.com/questions/79935417",
      );
      expect(
        typeof result === "string" ? result : String(result),
      ).toMatchSnapshot();
    });
  });
});
