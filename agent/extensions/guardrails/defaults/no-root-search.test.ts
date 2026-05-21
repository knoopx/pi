import { describe, it, expect } from "vitest";
import defaults from "./no-root-search";
import { commandGroupMatches } from "../test-helpers";

describe("no-root-search", () => {
  it("then blocks find from root /", () => {
    expect(
      commandGroupMatches(defaults, "no-root-search", "find / -name '*.ts'"),
    ).toBe(true);
    expect(
      commandGroupMatches(
        defaults,
        "no-root-search",
        "find / -type f -name '*.db'",
      ),
    ).toBe(true);
  });

  it("then blocks find from root with maxdepth (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-root-search",
        'find / -maxdepth 4 -name "pyrescene" 2>/dev/null | head -10',
      ),
    ).toBe(true);
  });

  it("then blocks fd with root / as last arg", () => {
    expect(commandGroupMatches(defaults, "no-root-search", "fd . / ")).toBe(
      true,
    );
  });

  it("then blocks grep from root /", () => {
    expect(
      commandGroupMatches(defaults, "no-root-search", 'grep -r "import" / -l'),
    ).toBe(true);
  });

  it("then blocks rg from root /", () => {
    expect(
      commandGroupMatches(defaults, "no-root-search", 'rg "pattern" / -l'),
    ).toBe(true);
  });

  it("then blocks locate", () => {
    expect(
      commandGroupMatches(defaults, "no-root-search", 'locate "binary"'),
    ).toBe(true);
  });

  it("then allows find from project directory", () => {
    expect(
      commandGroupMatches(defaults, "no-root-search", "find . -name '*.ts'"),
    ).toBe(false);
  });

  it("then allows find from known sub-paths", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-root-search",
        "find /var/lib/plex/ -name '*.db'",
      ),
    ).toBe(false);
  });

  it("then allows grep from project directory", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-root-search",
        'grep -r "pattern" ./src',
      ),
    ).toBe(false);
  });
});
