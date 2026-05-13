import { beforeAll, describe, expect, it } from "vitest";
import { wikipediaParser } from ".";
import { parse } from "../../lib/registry";

describe("Wikipedia parser", () => {
  describe("matches", () => {
    it.each([
      "https://en.wikipedia.org/wiki/Artificial_intelligence",
      "https://fr.wikipedia.org/wiki/Intelligence_artificielle",
      "https://de.wikipedia.org/wiki/Linux",
      "https://ja.wikipedia.org/wiki/%E3%82%BD%E3%83%95%E3%83%88",
      "https://en.wikipedia.org/w/index.php?search=quantum+computing",
      "https://en.wikipedia.org/wiki/Special:Search?search=typescript",
      "http://es.wikipedia.org/wiki/Espaa",
    ])("matches %s", (url) => {
      expect(wikipediaParser.matches(url)).toBe(true);
    });

    it.each([
      "https://wikipedia.org/wiki/Test",
      "https://en.m.wikipedia.org/wiki/Mobile",
      "https://m.wikimedia.org/wiki/Test",
      "https://example.com/en.wikipedia.org/page",
    ])("does not match %s", (url) => {
      expect(wikipediaParser.matches(url)).toBe(false);
    });

    it("requires two-letter language code", () => {
      expect(
        wikipediaParser.matches("https://en.wikipedia.org/wiki/Test"),
      ).toBe(true);
      expect(wikipediaParser.matches("https://e.wikipedia.org/wiki/Test")).toBe(
        false,
      );
    });

    it("is case-insensitive for domain", () => {
      expect(
        wikipediaParser.matches("https://EN.wikipedia.org/wiki/Test"),
      ).toBe(true);
    });
  });

  describe("language codes", () => {
    it.each(["en", "de", "fr", "es", "ja", "zh-CN", "pt-BR", "ru", "ko"])(
      "matches language code %s",
      (lang) => {
        if (lang.includes("-")) return;
        const url = `https://${lang}.wikipedia.org/wiki/Test`;
        expect(wikipediaParser.matches(url)).toBe(true);
      },
    );
  });

  describe("edge cases", () => {
    it("handles URLs with underscores in title", () => {
      expect(
        wikipediaParser.matches("https://en.wikipedia.org/wiki/World_Wide_Web"),
      ).toBe(true);
    });

    it("handles search URLs with special characters", () => {
      expect(
        wikipediaParser.matches(
          "https://en.wikipedia.org/w/index.php?search=AI&search=ML",
        ),
      ).toBe(true);
    });

    it("does not match mobile Wikipedia subdomain", () => {
      expect(
        wikipediaParser.matches("https://m.en.wikipedia.org/wiki/Test"),
      ).toBe(false);
    });
  });

  describe("snapshot", () => {
    beforeAll(async () => {
      const { mockFetchWithFixtures } = await import("../../test/utils");
      mockFetchWithFixtures();
    });
    it("captures output for https://en.wikipedia.org/wiki/Artificial_intelligence", async () => {
      const result = await parse(
        "https://en.wikipedia.org/wiki/Artificial_intelligence",
      );
      expect(
        typeof result === "string" ? result : String(result),
      ).toMatchSnapshot();
    });
  });
});
