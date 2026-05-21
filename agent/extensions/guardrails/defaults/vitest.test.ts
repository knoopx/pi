import { describe, it, expect } from "vitest";
import defaults from "./vitest";
import { commandGroupMatches } from "../test-helpers";

describe("vitest", () => {
  it("then blocks bun test, allows bun vitest run", () => {
    expect(commandGroupMatches(defaults, "vitest", "bun test")).toBe(true);
    expect(commandGroupMatches(defaults, "vitest", "bun vitest run")).toBe(
      false,
    );
  });
});
