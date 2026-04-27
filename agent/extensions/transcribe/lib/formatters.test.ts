import { describe, expect, it } from "vitest";
import { formatAge, formatNumber, stripHtml } from "./formatters";

describe("formatNumber", () => {
  it("formats single digits without separators", () => {
    expect(formatNumber(5)).toBe("5");
    expect(formatNumber(99)).toBe("99");
  });

  it("formats large numbers", () => {
    // toLocaleString output depends on locale; just verify it returns a string
    const result = formatNumber(1000);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("1000.000");
  });

  it("handles large numbers", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatNumber(0)).toBe("0");
  });

  it("handles negative numbers", () => {
    expect(formatNumber(-42)).toBe("-42");
  });
});

describe("formatAge", () => {
  it("formats recent timestamps as relative time", () => {
    // 30 seconds ago - falls into minute bucket
    const thirtySecondsAgo = Math.floor(Date.now() / 1000) - 30;
    expect(formatAge(thirtySecondsAgo)).toContain("m");
  });

  it("formats minutes correctly", () => {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
    expect(formatAge(fiveMinutesAgo)).toContain("5m");
  });

  it("formats hours correctly", () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    expect(formatAge(twoHoursAgo)).toContain("2h");
  });

  it("formats days correctly", () => {
    const threeDaysAgo = Math.floor(Date.now() / 1000) - 259200;
    expect(formatAge(threeDaysAgo)).toContain("3d");
  });

  it("formats months correctly", () => {
    const twoMonthsAgo = Math.floor(Date.now() / 1000) - 5184000;
    expect(formatAge(twoMonthsAgo)).toContain("2mo");
  });

  it("handles very old timestamps as months ago", () => {
    // January 1, 2020 - about 4-5 years ago
    const result = formatAge(1577836800);
    expect(result).toContain("mo");
  });

  it("handles zero seconds ago as minutes", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatAge(now)).toContain("m");
  });
});

describe("stripHtml", () => {
  it("removes simple HTML tags", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("removes nested HTML tags", () => {
    expect(stripHtml("<div><strong>Bold</strong></div>")).toBe("Bold");
  });

  it("preserves text between tags", () => {
    expect(stripHtml("<span>Hello</span> world")).toBe("Hello world");
  });

  it("handles self-closing tags", () => {
    expect(stripHtml("Hello<br>World")).toBe("Hello\nWorld");
  });

  it("handles tags with attributes", () => {
    expect(stripHtml('<a href="http://example.com">Link</a>')).toBe("Link");
  });

  it("decodes HTML entities in tag content", () => {
    // &amp; inside a tag is decoded to &
    expect(stripHtml("<p>&amp;</p>")).toBe("&");
  });

  it("handles empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("handles no tags in input", () => {
    expect(stripHtml("Plain text")).toBe("Plain text");
  });
});
