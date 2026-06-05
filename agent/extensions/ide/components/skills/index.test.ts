import { describe, it, expect } from "vitest";
import { filterSkills } from "./component";
import type { SkillInfo } from "./types";

describe("filterSkills", () => {
  const skills: SkillInfo[] = [
    {
      id: "build-gtkx-apps",
      label: "build-gtkx-apps",
      name: "build-gtkx-apps",
      topic: "GTKX Apps",
      description: "Build GTK4 desktop apps with GTKX",
      skillType: "knowledge",
      keywords: ["gtkx", "gtk4", "desktop"],
      path: "/home/user/agent/skills/knowledge/build-gtkx-apps/SKILL.md",
    },
    {
      id: "read-protocols-first",
      label: "read-protocols-first",
      name: "read-protocols-first",
      topic: "Protocol Compliance",
      description: "Read relevant protocol skills before acting",
      skillType: "protocol",
      keywords: ["protocol", "binding"],
      path: "/home/user/agent/skills/protocols/read-protocols-first/SKILL.md",
    },
    {
      id: "jj",
      label: "jj",
      name: "jj",
      topic: "Jujutsu",
      description: "Manage version control with Jujutsu",
      skillType: "tool",
      keywords: ["jj", "jujutsu", "vcs"],
      path: "/home/user/agent/skills/tools/jj/SKILL.md",
    },
  ];

  it("returns all items for empty query", () => {
    const result = filterSkills(skills, "");
    expect(result).toHaveLength(3);
  });

  it("filters by name", () => {
    const result = filterSkills(skills, "gtkx");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("build-gtkx-apps");
  });

  it("filters by topic", () => {
    const result = filterSkills(skills, "protocol");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("read-protocols-first");
  });

  it("filters by keyword", () => {
    const result = filterSkills(skills, "jujutsu");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("jj");
  });

  it("filters by description", () => {
    const result = filterSkills(skills, "version control");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("jj");
  });

  it("is case-insensitive", () => {
    const result = filterSkills(skills, "GTKX");
    expect(result).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    const result = filterSkills(skills, "nonexistent-zzz");
    expect(result).toHaveLength(0);
  });
});
