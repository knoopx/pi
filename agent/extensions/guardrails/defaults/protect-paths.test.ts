import { describe, it, expect } from "vitest";
import defaults from "./protect-paths";
import { fileNameGroupMatches } from "../test-helpers";

describe("protect-paths", () => {
  it("then blocks .git/** file access", () => {
    expect(fileNameGroupMatches(defaults, "protect-paths", ".git/config")).toBe(
      true,
    );
    expect(
      fileNameGroupMatches(defaults, "protect-paths", ".git/objects/pack"),
    ).toBe(true);
  });

  it("then blocks .jj/** file access except workspaces", () => {
    expect(
      fileNameGroupMatches(defaults, "protect-paths", ".jj/repo/config.toml"),
    ).toBe(true);
    expect(
      fileNameGroupMatches(defaults, "protect-paths", ".jj/workspaces/default"),
    ).toBe(false);
  });

  it("then allows normal files", () => {
    expect(
      fileNameGroupMatches(defaults, "protect-paths", "src/index.ts"),
    ).toBe(false);
    expect(fileNameGroupMatches(defaults, "protect-paths", "README.md")).toBe(
      false,
    );
  });
});
