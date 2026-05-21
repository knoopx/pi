import { describe, it, expect } from "vitest";
import defaults from "./nix";
import { commandGroupMatches } from "../test-helpers";

describe("nix", () => {
  it("then blocks bare dot ref, allows path:.", () => {
    expect(commandGroupMatches(defaults, "nix", "nix run .")).toBe(true);
    expect(commandGroupMatches(defaults, "nix", "nix run path:.")).toBe(false);
  });

  it("then blocks pre-computed hash commands", () => {
    expect(
      commandGroupMatches(
        defaults,
        "nix",
        "nix-prefetch-url https://example.com/file",
      ),
    ).toBe(true);
    expect(
      commandGroupMatches(defaults, "nix", "nix hash file /path/to/file"),
    ).toBe(true);
  });

  it("then allows nix run with path:", () => {
    expect(commandGroupMatches(defaults, "nix", "nix run path:.#command")).toBe(
      false,
    );
  });

  it("then blocks nix profile install and add", () => {
    expect(commandGroupMatches(defaults, "nix", "nix profile install nixpkgs#git")).toBe(true);
    expect(commandGroupMatches(defaults, "nix", "nix profile add ./result")).toBe(true);
  });

  it("then allows nix run and nix shell as alternatives", () => {
    expect(commandGroupMatches(defaults, "nix", "nix run nixpkgs#git")).toBe(false);
    expect(commandGroupMatches(defaults, "nix", "nix shell nixpkgs#git")).toBe(false);
  });
});
