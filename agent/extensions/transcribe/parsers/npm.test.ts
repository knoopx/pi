import { describe, expect, it } from "vitest";
import { npmParser } from "./npm";

describe("npm parser", () => {
  describe("matches", () => {
    it.each([
      "https://www.npmjs.com/package/react",
      "https://npmjs.com/package/lodash",
      "http://www.npmjs.com/package/typescript",
      "https://www.npmjs.com/package/@types/node",
      "https://www.npmjs.com/package/vitest",
    ])("matches %s", (url) => {
      expect(npmParser.matches(url)).toBe(true);
    });

    it.each([
      "https://registry.npmjs.org/react",
      "https://example.com/npm/package",
      "https://notnpmjs.com/package/test",
      "https://www.npmjs.org/package/test",
    ])("does not match %s", (url) => {
      expect(npmParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(npmParser.matches("https://WWW.NPMJS.COM/package/react")).toBe(
        true,
      );
    });

    it("handles scoped packages", () => {
      expect(
        npmParser.matches("https://www.npmjs.com/package/@babel/core"),
      ).toBe(true);
    });
  });

  describe("path parsing", () => {
    it("recognizes package URLs", () => {
      expect(npmParser.matches("https://www.npmjs.com/package/react")).toBe(
        true,
      );
    });

    it("recognizes versioned URLs", () => {
      expect(
        npmParser.matches("https://www.npmjs.com/package/react/v1.0.0"),
      ).toBe(true);
    });

    it("recognizes versioned URLs with v prefix", () => {
      expect(
        npmParser.matches("https://www.npmjs.com/package/react/v2.0.0"),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles URL-encoded package names", () => {
      expect(
        npmParser.matches("https://www.npmjs.com/package/%40babel%2Fcore"),
      ).toBe(true);
    });

    it("handles URLs with trailing slashes", () => {
      expect(npmParser.matches("https://www.npmjs.com/package/react/")).toBe(
        true,
      );
    });

    it("handles URLs with query strings", () => {
      expect(
        npmParser.matches("https://www.npmjs.com/package/react?tab=readme"),
      ).toBe(true);
    });
  });
});
