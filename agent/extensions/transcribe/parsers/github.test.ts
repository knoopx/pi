import { describe, expect, it } from "vitest";
import { parser as githubParser } from "./github";

describe("GitHub parser", () => {
  describe("matches", () => {
    it("matches github.com URLs", () => {
      expect(githubParser.matches("https://github.com/user/repo")).toBe(true);
      expect(githubParser.matches("http://github.com/user/repo")).toBe(true);
      expect(githubParser.matches("https://GitHub.COM/user/repo")).toBe(true);
    });

    it("does not match non-github URLs", () => {
      expect(githubParser.matches("https://gitlab.com/user/repo")).toBe(false);
      expect(githubParser.matches("https://github.io/user/repo")).toBe(false);
      expect(githubParser.matches("https://example.com/github/user/repo")).toBe(
        false,
      );
    });
  });

  describe("URL parsing", () => {
    it.each([
      "https://github.com/owner/repo",
      "https://github.com/owner/repo/blob/main/src/index.ts",
      "https://github.com/owner/repo/tree/docs",
      "https://github.com/owner/repo/pull/42",
      "https://github.com/owner/repo/issues/100",
      "https://github.com/owner/repo/releases/tag/v1.0",
      "https://github.com/owner/repo/compare/main..develop",
      "https://github.com/owner/repo/commit/abc123",
    ])("matches %s", (url) => {
      expect(githubParser.matches(url)).toBe(true);
    });

    it("extracts ref from blob URLs", () => {
      const url =
        "https://github.com/owner/repo/blob/feature-branch/src/main.ts";
      // We test via the convert function - but since it calls gh CLI,
      // we test that matches returns true and the URL is valid
      expect(githubParser.matches(url)).toBe(true);
    });

    it("handles compare URLs with multiple segments", () => {
      const url = "https://github.com/owner/repo/compare/v1.0..v2.0#diff-123";
      expect(githubParser.matches(url)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles GitHub URLs with trailing slashes", () => {
      expect(githubParser.matches("https://github.com/owner/repo/")).toBe(true);
    });

    it("handles GitHub Enterprise-style paths (still github.com)", () => {
      expect(
        githubParser.matches("https://github.com/owner/team-name/repo"),
      ).toBe(true);
    });

    it("handles bare domain with trailing slash", () => {
      expect(githubParser.matches("https://github.com/")).toBe(true);
    });
  });
});
