import { describe, it, expect } from "vitest";
import defaults from "./testing";
import { fileContentGroupMatches } from "../test-helpers";

describe("testing", () => {
  it("then matches skip patterns, allows normal tests", () => {
    expect(fileContentGroupMatches(defaults, "testing", "it.skip('x')")).toBe(
      true,
    );
    expect(
      fileContentGroupMatches(defaults, "testing", "describe.skip('x')"),
    ).toBe(true);
    expect(fileContentGroupMatches(defaults, "testing", "xit('x')")).toBe(true);
    expect(fileContentGroupMatches(defaults, "testing", "it('x')")).toBe(false);
  });

  it("then blocks xdescribe pattern", () => {
    expect(
      fileContentGroupMatches(defaults, "testing", "xdescribe('suite')"),
    ).toBe(true);
  });

  it("then allows normal test patterns", () => {
    expect(
      fileContentGroupMatches(
        defaults,
        "testing",
        "it('should work', () => {})",
      ),
    ).toBe(false);
    expect(
      fileContentGroupMatches(
        defaults,
        "testing",
        "describe('suite', () => {})",
      ),
    ).toBe(false);
  });
});
