import { beforeAll, describe, expect, it } from "vitest";
import { pypiParser } from "./pypi";
import { parse } from "../lib/registry";

describe("PyPI parser", () => {
  describe("matches", () => {
    it.each([
      "https://pypi.org/project/requests/",
      "https://pypi.org/project/flask/",
      "http://pypi.org/project/numpy/",
      "https://pypi.org/project/certifi/",
    ])("matches %s", (url) => {
      expect(pypiParser.matches(url)).toBe(true);
    });

    it.each([
      "https://test.pypi.org/project/requests/",
      "https://example.com/pypi/package",
      "https://notpypi.org/project/test",
    ])("does not match %s", (url) => {
      expect(pypiParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(pypiParser.matches("https://PYPI.ORG/project/requests/")).toBe(
        true,
      );
    });
  });

  describe("path parsing", () => {
    it("recognizes package URLs", () => {
      expect(pypiParser.matches("https://pypi.org/project/requests/")).toBe(
        true,
      );
    });

    it("recognizes versioned URLs", () => {
      expect(
        pypiParser.matches("https://pypi.org/project/requests/2.28.0"),
      ).toBe(true);
    });

    it("recognizes versioned URLs with v prefix", () => {
      expect(
        pypiParser.matches("https://pypi.org/project/requests/v2.28.0"),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles URL-encoded package names", () => {
      expect(
        pypiParser.matches("https://pypi.org/project/%40babel%2Fcore/"),
      ).toBe(true);
    });

    it("handles URLs with trailing slashes", () => {
      expect(pypiParser.matches("https://pypi.org/project/requests///")).toBe(
        true,
      );
    });
  });

  describe("snapshot", () => {
    beforeAll(async () => {
      const { mockFetchWithFixtures } = await import("../test/utils");
      mockFetchWithFixtures();
    });
    it("captures output for https://pypi.org/project/requests/", async () => {
      const result = await parse("https://pypi.org/project/requests/");
      expect(
        typeof result === "string" ? result : String(result),
      ).toMatchSnapshot();
    });
  });
});
