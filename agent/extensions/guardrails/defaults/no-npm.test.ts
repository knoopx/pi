import { describe, it, expect } from "vitest";
import defaults from "./no-npm";
import { commandGroupMatches } from "../test-helpers";

describe("no-npm", () => {
  it("then blocks npm commands globally", () => {
    expect(commandGroupMatches(defaults, "no-npm", "npm install")).toBe(true);
    expect(commandGroupMatches(defaults, "no-npm", "npm run")).toBe(true);
    expect(commandGroupMatches(defaults, "no-npm", "npm")).toBe(true);
    expect(commandGroupMatches(defaults, "no-npm", "bun install")).toBe(false);
  });

  it("then blocks npx", () => {
    expect(
      commandGroupMatches(defaults, "no-npm", "npx create-react-app"),
    ).toBe(true);
    expect(commandGroupMatches(defaults, "no-npm", "npx tsx script.ts")).toBe(
      true,
    );
  });

  it("then allows bun equivalents", () => {
    expect(commandGroupMatches(defaults, "no-npm", "bun add react")).toBe(
      false,
    );
    expect(
      commandGroupMatches(defaults, "no-npm", "bunx create-react-app"),
    ).toBe(false);
  });
});
