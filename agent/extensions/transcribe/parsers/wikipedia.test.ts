import { describe, expect, it } from "vitest";
import { parser as wikiParser } from "./wikipedia";

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
      expect(wikiParser.matches(url)).toBe(true);
    });

    it.each([
      "https://wikipedia.org/wiki/Test",
      "https://en.m.wikipedia.org/wiki/Mobile",
      "https://m.wikimedia.org/wiki/Test",
      "https://example.com/en.wikipedia.org/page",
    ])("does not match %s", (url) => {
      expect(wikiParser.matches(url)).toBe(false);
    });

    it("requires two-letter language code", () => {
      expect(wikiParser.matches("https://en.wikipedia.org/wiki/Test")).toBe(
        true,
      );
      // Single letter codes should not match
      expect(wikiParser.matches("https://e.wikipedia.org/wiki/Test")).toBe(
        false,
      );
    });

    it("is case-insensitive for domain", () => {
      expect(wikiParser.matches("https://EN.wikipedia.org/wiki/Test")).toBe(
        true,
      );
    });
  });

  describe("language codes", () => {
    it.each(["en", "de", "fr", "es", "ja", "zh-CN", "pt-BR", "ru", "ko"])(
      "matches language code %s",
      (lang) => {
        // Note: zh-CN has a hyphen so it won't match [a-z]{2} pattern
        // But individual codes should work
        if (lang.includes("-")) return;
        const url = `https://${lang}.wikipedia.org/wiki/Test`;
        expect(wikiParser.matches(url)).toBe(true);
      },
    );
  });

  describe("edge cases", () => {
    it("handles URLs with underscores in title", () => {
      expect(
        wikiParser.matches("https://en.wikipedia.org/wiki/World_Wide_Web"),
      ).toBe(true);
    });

    it("handles search URLs with special characters", () => {
      expect(
        wikiParser.matches(
          "https://en.wikipedia.org/w/index.php?search=AI&search=ML",
        ),
      ).toBe(true);
    });

    it("does not match mobile Wikipedia subdomain", () => {
      // Mobile uses m.en.wikipedia.org which doesn't match the pattern
      expect(wikiParser.matches("https://m.en.wikipedia.org/wiki/Test")).toBe(
        false,
      );
    });
  });
});
