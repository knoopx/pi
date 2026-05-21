import { describe, it, expect } from "vitest";
import { parseWikiUrl } from "./url-parsing";

describe("parseWikiUrl", () => {
  it("parses English article URL", () => {
    const result = parseWikiUrl(
      "https://en.wikipedia.org/wiki/TypeScript_(programming_language)",
    );
    expect(result).toEqual({
      type: "article",
      title: "TypeScript (programming language)",
      lang: "en",
    });
  });

  it("parses article URL with underscores replaced by spaces", () => {
    const result = parseWikiUrl("https://en.wikipedia.org/wiki/Hello_world");
    expect(result).toEqual({
      type: "article",
      title: "Hello world",
      lang: "en",
    });
  });

  it("parses German article URL", () => {
    const result = parseWikiUrl("https://de.wikipedia.org/wiki/JavaScript");
    expect(result).toEqual({
      type: "article",
      title: "JavaScript",
      lang: "de",
    });
  });

  it("parses French article URL", () => {
    const result = parseWikiUrl(
      "https://fr.wikipedia.org/wiki/Python_(langage)",
    );
    expect(result).toEqual({
      type: "article",
      title: "Python (langage)",
      lang: "fr",
    });
  });

  it("parses URL-encoded article title", () => {
    const result = parseWikiUrl(
      "https://en.wikipedia.org/wiki/A%20Brief%20History%20of%20Time",
    );
    expect(result).toEqual({
      type: "article",
      title: "A Brief History of Time",
      lang: "en",
    });
  });

  it("parses search URL", () => {
    const result = parseWikiUrl(
      "https://en.wikipedia.org/w/index.php?search=typescript&language=en",
    );
    expect(result).toEqual({
      type: "search",
      query: "typescript",
      lang: "en",
      limit: 10,
    });
  });

  it("parses search with custom limit", () => {
    const result = parseWikiUrl(
      "https://en.wikipedia.org/w/index.php?search=typescript&limit=5",
    );
    expect(result).toEqual({
      type: "search",
      query: "typescript",
      lang: "en",
      limit: 5,
    });
  });

  it("parses Special:Search URL", () => {
    const result = parseWikiUrl(
      "https://en.wikipedia.org/wiki/Special:Search?search=typescript",
    );
    expect(result).toEqual({
      type: "search",
      query: "typescript",
      lang: "en",
      limit: 10,
    });
  });

  it("returns null for non-wikipedia URL", () => {
    expect(parseWikiUrl("https://www.example.com/page")).toBeNull();
  });

  it("returns null for missing language code", () => {
    expect(parseWikiUrl("https://wikipedia.org/wiki/Test")).toBeNull();
  });

  it("handles trailing slashes", () => {
    const result = parseWikiUrl("https://en.wikipedia.org/wiki/Test///");
    expect(result).toEqual({
      type: "article",
      title: "Test",
      lang: "en",
    });
  });

  it("handles empty path after lang", () => {
    expect(parseWikiUrl("https://en.wikipedia.org/")).toBeNull();
  });
});
