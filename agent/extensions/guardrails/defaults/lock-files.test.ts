import { describe, it, expect } from "vitest";
import defaults from "./lock-files";
import { fileNameGroupMatches } from "../test-helpers";

describe("lock-files", () => {
  it("then matches known lock files, rejects manifests", () => {
    const locks = [
      "package-lock.json",
      "bun.lockb",
      "yarn.lock",
      "uv.lock",
      "Cargo.lock",
      "flake.lock",
    ];
    for (const f of locks) {
      expect(fileNameGroupMatches(defaults, "lock-files", f)).toBe(true);
    }
    expect(fileNameGroupMatches(defaults, "lock-files", "package.json")).toBe(
      false,
    );
  });
});
