import { describe, it, expect } from "vitest";
import { formatSuggestions } from "./formatter";

describe("formatSuggestions", () => {
  describe("given an empty list of hits", () => {
    it("then it should return an empty string", () => {
      expect(formatSuggestions([])).toBe("");
    });
  });

  describe("given a single hit", () => {
    const hits = [
      {
        score: 0.9,
        path: "/project/src/main.ts",
        relPath: "src/main.ts",
        symbols: "",
      },
    ];

    it("then it should return the relative path with score", () => {
      expect(formatSuggestions(hits)).toBe("src/main.ts (90%)");
    });
  });

  describe("given a hit with symbols", () => {
    const hits = [
      {
        score: 0.85,
        path: "/project/src/handlers.ts",
        relPath: "src/handlers.ts",
        symbols: "function handleRequest, method process, class RequestHandler",
      },
    ];

    it("then it should show the file with score and symbols on separate indented lines", () => {
      expect(formatSuggestions(hits)).toBe(
        "src/handlers.ts (85%)\n    function handleRequest\n    method process\n    class RequestHandler",
      );
    });
  });

  describe("given multiple hits", () => {
    const hits = [
      {
        score: 0.95,
        path: "/project/src/utils.ts",
        relPath: "src/utils.ts",
        symbols: "function format, function parse",
      },
      {
        score: 0.87,
        path: "/project/src/types.ts",
        relPath: "src/types.ts",
        symbols: "",
      },
      {
        score: 0.72,
        path: "/project/src/index.ts",
        relPath: "src/index.ts",
        symbols: "function main",
      },
    ];

    it("then it should list all relative paths with scores on separate lines", () => {
      expect(formatSuggestions(hits)).toBe(
        "src/utils.ts (95%)\n    function format\n    function parse\nsrc/types.ts (87%)\nsrc/index.ts (72%)\n    function main",
      );
    });
  });

  describe("given hits with nested paths", () => {
    const hits = [
      {
        score: 0.9,
        path: "/project/packages/core/lib/mod.ts",
        relPath: "packages/core/lib/mod.ts",
        symbols: "class Module, function init",
      },
    ];

    it("then it should preserve the full relative path with score and symbols", () => {
      expect(formatSuggestions(hits)).toBe(
        "packages/core/lib/mod.ts (90%)\n    class Module\n    function init",
      );
    });
  });
});
