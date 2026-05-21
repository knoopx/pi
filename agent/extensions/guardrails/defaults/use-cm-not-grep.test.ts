import { describe, it, expect } from "vitest";
import defaults from "./use-cm-not-grep";
import { commandGroupMatches } from "../test-helpers";

describe("use-cm-not-grep", () => {
  it("then blocks grep -rn with --include=* (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "use-cm-not-grep",
        'grep -rn "HFPathType|RedditKind" --include="*.ts" .',
      ),
    ).toBe(true);
    expect(
      commandGroupMatches(
        defaults,
        "use-cm-not-grep",
        'grep -rn "as any" --include="*.ts" | head -30',
      ),
    ).toBe(true);
  });

  it("then blocks grep -rn with --include=* for any language", () => {
    expect(
      commandGroupMatches(
        defaults,
        "use-cm-not-grep",
        'grep -rn "symbolName" --include="*.tsx" .',
      ),
    ).toBe(true);
    expect(
      commandGroupMatches(
        defaults,
        "use-cm-not-grep",
        'grep -rn "func_name" --include="*.py" .',
      ),
    ).toBe(true);
  });

  it("then blocks grep -r with --include=* (no -n flag)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "use-cm-not-grep",
        'grep -r "pattern" --include="*.ts" .',
      ),
    ).toBe(true);
  });

  it("then allows grep without --include flag", () => {
    expect(
      commandGroupMatches(
        defaults,
        "use-cm-not-grep",
        'grep -rn "TODO" README.md',
      ),
    ).toBe(false);
    expect(
      commandGroupMatches(
        defaults,
        "use-cm-not-grep",
        'grep -rn "pattern" *.md',
      ),
    ).toBe(false);
  });
});
