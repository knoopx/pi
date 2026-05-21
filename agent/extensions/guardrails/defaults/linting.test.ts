import { describe, it, expect } from "vitest";
import defaults from "./linting";
import { fileContentGroupMatches } from "../test-helpers";

describe("linting", () => {
  it("then matches eslint-disable", () => {
    expect(
      fileContentGroupMatches(defaults, "linting", "/* eslint-disable */"),
    ).toBe(true);
    expect(
      fileContentGroupMatches(defaults, "linting", "// normal comment"),
    ).toBe(false);
  });
});
