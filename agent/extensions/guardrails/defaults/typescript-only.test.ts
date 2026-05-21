import { describe, it, expect } from "vitest";
import defaults from "./typescript-only";
import { fileNameGroupMatches } from "../test-helpers";

describe("typescript-only", () => {
  it("then blocks .js files, excepts eslint config", () => {
    expect(fileNameGroupMatches(defaults, "typescript-only", "foo.js")).toBe(
      true,
    );
    expect(
      fileNameGroupMatches(defaults, "typescript-only", "eslint-config.js"),
    ).toBe(false);
    expect(fileNameGroupMatches(defaults, "typescript-only", "foo.ts")).toBe(
      false,
    );
  });
});
