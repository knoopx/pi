import { describe, it, expect } from "vitest";
import defaults from "./interactive";
import { commandGroupMatches } from "../test-helpers";

describe("interactive", () => {
  it("then blocks long-running servers", () => {
    expect(
      commandGroupMatches(defaults, "interactive", "bun run dev --port 3000"),
    ).toBe(true);
  });

  it("then allows non-dev bun run commands", () => {
    expect(commandGroupMatches(defaults, "interactive", "bun run build")).toBe(
      false,
    );
    expect(commandGroupMatches(defaults, "interactive", "bun run test")).toBe(
      false,
    );
  });

  it("then blocks vitest watch mode, allows run mode", () => {
    expect(commandGroupMatches(defaults, "interactive", "vitest")).toBe(true);
    expect(commandGroupMatches(defaults, "interactive", "bun vitest")).toBe(
      true,
    );
    expect(commandGroupMatches(defaults, "interactive", "vitest run")).toBe(
      false,
    );
    expect(commandGroupMatches(defaults, "interactive", "bun vitest run")).toBe(
      false,
    );
  });

  it("then blocks interactive REPLs and shells", () => {
    expect(commandGroupMatches(defaults, "interactive", "bun repl ")).toBe(
      true,
    );
    expect(commandGroupMatches(defaults, "interactive", "deno repl ")).toBe(
      true,
    );
  });

  it("then allows bun -e inline evaluation", () => {
    expect(
      commandGroupMatches(defaults, "interactive", 'bun -e "console.log(1)"'),
    ).toBe(false);
  });

  it("then blocks tsc watch mode, allows one-shot", () => {
    expect(commandGroupMatches(defaults, "interactive", "tsc --watch")).toBe(
      true,
    );
    expect(commandGroupMatches(defaults, "interactive", "tsc -w")).toBe(true);
    expect(commandGroupMatches(defaults, "interactive", "tsc --noEmit")).toBe(
      false,
    );
  });
});
