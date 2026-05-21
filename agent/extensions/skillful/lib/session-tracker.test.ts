import { describe, it, expect, beforeEach } from "vitest";
import { SessionTracker } from "./session-tracker";

function makeSkill(name: string): { name: string } {
  return { name };
}

describe("SessionTracker", () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    tracker = new SessionTracker();
  });

  it("allows skill that has not been read", () => {
    const skill = makeSkill("bash");
    expect(tracker.isRead(skill)).toEqual(false);
  });

  it("marks skill as read", () => {
    const skill = makeSkill("bash");
    tracker.markRead("bash");
    expect(tracker.isRead(skill)).toEqual(true);
  });

  it("detects skill name from path", () => {
    const name = tracker.isSkillRead(
      "/home/user/.pi/agent/skills/tools/bash/SKILL.md",
    );
    expect(name).toEqual("bash");
  });

  it("detects skill name from nested path", () => {
    const name = tracker.isSkillRead(
      "/home/user/.pi/agent/skills/protocols/naming-conventions/SKILL.md",
    );
    expect(name).toEqual("naming-conventions");
  });

  it("returns null for non-skill paths", () => {
    expect(tracker.isSkillRead("/tmp/file.txt")).toEqual(null);
    expect(tracker.isSkillRead("/home/user/README.md")).toEqual(null);
    expect(tracker.isSkillRead("")).toEqual(null);
  });

  it("resets all state", () => {
    tracker.markRead("bash");
    tracker.markRead("nix");
    tracker.reset();
    expect(tracker.isRead(makeSkill("bash"))).toEqual(false);
    expect(tracker.isRead(makeSkill("nix"))).toEqual(false);
  });

  it("is case insensitive", () => {
    tracker.markRead("BASH");
    expect(tracker.isRead(makeSkill("bash"))).toEqual(true);
    expect(tracker.isRead(makeSkill("Bash"))).toEqual(true);
  });
});
