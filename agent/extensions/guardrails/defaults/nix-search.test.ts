import { describe, it, expect } from "vitest";
import defaults from "./nix-search";
import { commandGroupMatches } from "../test-helpers";

describe("nix-search", () => {
  it("then blocks nix search", () => {
    expect(commandGroupMatches(defaults, "nix-search", "nix search vim")).toBe(
      true,
    );
    expect(
      commandGroupMatches(defaults, "nix-search", "nix search --name nodejs"),
    ).toBe(true);
  });

  it("then allows other nix commands", () => {
    expect(
      commandGroupMatches(defaults, "nix-search", "nix run nixpkgs#vim"),
    ).toBe(false);
    expect(
      commandGroupMatches(defaults, "nix-search", "nix build path:."),
    ).toBe(false);
  });
});
