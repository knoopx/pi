import { describe, expect, it } from "vitest";
import brotabDefaults from "./brotab";

describe("brotab guardrails", () => {
  it("blocks brotab close on any tab", () => {
    const result = brotabDefaults[0].rules[0];
    expect(result.action).toBe("block");
    expect(result.reason).toContain("NEVER close user tabs");
  });

  it("has the correct pattern for brotab close", () => {
    const result = brotabDefaults[0].rules[0];
    expect(result.pattern).toBe("brotab close *");
  });
});
