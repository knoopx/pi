import { describe, it, expect } from "vitest";
import {
  defineParser,
  createVersionedPackageParser,
  requireVersion,
} from "./parser-factory";

describe("defineParser", () => {
  it("creates a parser with matches and convert", async () => {
    const parser = defineParser(
      "example.com",
      (_url) => _url.includes("example.com"),
      (_url) => ({ url: _url }),
      async (parsed) => `Parsed: ${parsed.url}`,
    );

    expect(parser.matches("https://example.com/page")).toBe(true);
    expect(parser.matches("https://other.com/page")).toBe(false);

    const result = await parser.convert("https://example.com/page");
    expect(result).toBe("Parsed: https://example.com/page");
  });

  it("throws when parse returns null", async () => {
    const parser = defineParser(
      "test.com",
      () => true,
      () => null,
      async () => "",
    );

    await expect(parser.convert("https://test.com")).rejects.toThrow(
      "Unable to parse test.com URL",
    );
  });
});

describe("createVersionedPackageParser", () => {
  it("parses npm package URL without version", () => {
    const parser = createVersionedPackageParser(/npmjs\.com\/package\/([^/]+)/);
    const result = parser("https://www.npmjs.com/package/lodash");
    expect(result).toEqual({ kind: "package", name: "lodash" });
  });

  it("parses npm package URL with version", () => {
    const parser = createVersionedPackageParser(/npmjs\.com\/package\/([^/]+)/);
    const result = parser("https://www.npmjs.com/package/lodash/v/4.17.21");
    expect(result).toEqual({
      kind: "version",
      name: "lodash",
      version: "v/4.17.21",
    });
  });

  it("parses pypi package URL without version", () => {
    const parser = createVersionedPackageParser(/pypi\.org\/project\/([^/]+)/);
    const result = parser("https://pypi.org/project/requests");
    expect(result).toEqual({ kind: "package", name: "requests" });
  });

  it("parses pypi package URL with version", () => {
    const parser = createVersionedPackageParser(/pypi\.org\/project\/([^/]+)/);
    const result = parser("https://pypi.org/project/requests/2.31.0");
    expect(result).toEqual({
      kind: "version",
      name: "requests",
      version: "2.31.0",
    });
  });

  it("returns null for non-matching URL", () => {
    const parser = createVersionedPackageParser(/npmjs\.com\/package\/([^/]+)/);
    expect(parser("https://other.com/package/foo")).toBeNull();
  });

  it("handles URL-encoded package names", () => {
    const parser = createVersionedPackageParser(/npmjs\.com\/package\/([^/]+)/);
    const result = parser("https://www.npmjs.com/package/%40types%2Fnode");
    expect(result).toEqual({ kind: "package", name: "@types/node" });
  });
});

describe("requireVersion", () => {
  it("returns version when present", () => {
    expect(
      requireVersion({ kind: "version", name: "lodash", version: "4.17.21" }),
    ).toBe("4.17.21");
  });

  it("throws when version is missing", () => {
    expect(() => requireVersion({ kind: "package", name: "lodash" })).toThrow(
      "Missing version",
    );
  });
});
