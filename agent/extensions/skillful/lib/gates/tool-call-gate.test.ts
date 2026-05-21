import { describe, it, expect } from "vitest";
import { blockToolCall } from "./tool-call-gate";

function makeIsRead(readSkills: string[]) {
  const readSet = new Set(readSkills.map((s) => s.toLowerCase()));
  return (skill: { name: string }) => readSet.has(skill.name.toLowerCase());
}

function makeSkill(name: string, path: string) {
  return { name, path } as import("../skills-registry").SkillEntry;
}

// Simulates a tracker class with a method that uses `this` —
// passing it as an unbound callback would lose `this` and crash.
class FakeTracker {
  private read = new Set<string>();
  isRead(skill: { name: string }): boolean {
    return this.read.has(skill.name.toLowerCase());
  }
}

describe("blockToolCall", () => {
  it("allows read tool always", () => {
    const skill = makeSkill("read", "tools/read/SKILL.md");
    expect(blockToolCall("read", skill, makeIsRead([]))).toBeUndefined();
  });

  it("allows read tool even when its skill has NOT been read", () => {
    const skill = makeSkill("read", "tools/read/SKILL.md");
    // Empty tracker — read skill was never read, but tool must still be allowed
    expect(blockToolCall("read", skill, makeIsRead([]))).toBeUndefined();
  });

  it("allows tools without a registered skill", () => {
    expect(
      blockToolCall("custom_tool", undefined, makeIsRead([])),
    ).toBeUndefined();
  });

  it("allows tool when its skill has been read", () => {
    const skill = makeSkill("bash", "tools/bash/SKILL.md");
    expect(blockToolCall("bash", skill, makeIsRead(["bash"]))).toBeUndefined();
  });

  it("returns reason with full path when skill has NOT been read", () => {
    const skill = makeSkill("nix", "tools/nix/SKILL.md");
    const result = blockToolCall("nix", skill, makeIsRead([]));
    expect(result).toEqual({
      block: true,
      reason: "Read ~/.pi/agent/skills/tools/nix/SKILL.md before using nix.",
    });
  });

  it("includes full skill path in reason", () => {
    const skill = makeSkill("duckdb-repl", "tools/duckdb/SKILL.md");
    const result = blockToolCall("duckdb-repl", skill, makeIsRead([]));
    expect(result).toEqual({
      block: true,
      reason:
        "Read ~/.pi/agent/skills/tools/duckdb/SKILL.md before using duckdb-repl.",
    });
  });

  it("resolves full path in reason — not bare relative path", () => {
    const skill = makeSkill("bash", "tools/bash/SKILL.md");
    const result = blockToolCall("bash", skill, makeIsRead([]));
    expect(result?.reason).toEqual(
      "Read ~/.pi/agent/skills/tools/bash/SKILL.md before using bash.",
    );
  });

  it("is case-insensitive for read tracking", () => {
    const skill = makeSkill("bash", "tools/bash/SKILL.md");
    expect(blockToolCall("bash", skill, makeIsRead(["BASH"]))).toBeUndefined();
  });

  // Regression: the bug was that tracker.isRead lost `this` binding
  // when passed as a bare method reference, crashing with
  // "Cannot read properties of undefined (reading 'read')".
  // The fix wraps it in an arrow function: (s) => tracker.isRead(s).
  it("does not crash when isRead callback uses this internally", () => {
    const tracker = new FakeTracker();
    const skill = makeSkill("bash", "tools/bash/SKILL.md");

    // This would throw "Cannot read properties of undefined (reading 'read')"
    // if isRead was passed as an unbound method reference.
    expect(() =>
      blockToolCall("bash", skill, (s) => tracker.isRead(s)),
    ).not.toThrow();
  });

  it("uses toolName in reason string not skill.name", () => {
    const skill = makeSkill("some-skill", "tools/foo/SKILL.md");
    const result = blockToolCall("actual-tool", skill, makeIsRead([]));
    expect(result?.reason).toContain("actual-tool");
  });
});
