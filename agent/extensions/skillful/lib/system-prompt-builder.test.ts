import { describe, expect, it } from "vitest";
import type { SkillEntry } from "./skills-registry";
import {
  buildSystemPrompt,
  formatSkillsSection,
  formatToolsSection,
} from "./system-prompt-builder";

function makeSkill(
  name: string,
  subdir: "protocols" | "knowledge" | "tools",
): SkillEntry {
  return {
    name,
    path: `${subdir}/${name}/SKILL.md`,
    body: `# ${name}\n\nDescription here.`,
    size: 100,
    lineCount: 3,
    lastModified: Date.now(),
    targetTool: subdir === "tools" ? name : null,
    tokenCost: 50,
    topic: name,
    keywords: [],
    requiresTools: [],
    related: [],
    description: `Description for ${name}.`,
    commandPatterns: [],
    excludeCommandPatterns: [],
  };
}

describe("formatToolsSection", () => {
  it("returns empty string for empty list", () => {
    expect(formatToolsSection([])).toMatchSnapshot();
  });

  it("lists tools sorted alphabetically with descriptions", () => {
    const tools = [
      { name: "bash", description: "Execute bash commands" },
      { name: "read", description: "Read file contents" },
      { name: "edit", description: "Edit files" },
    ];

    expect(formatToolsSection(tools)).toMatchSnapshot();
  });

  it("includes full description", () => {
    const tools = [
      {
        name: "vitest",
        description: "Writes and runs tests.",
      },
    ];

    expect(formatToolsSection(tools)).toMatchSnapshot();
  });

  it("handles tools without descriptions", () => {
    const tools = [{ name: "my_tool" }];

    expect(formatToolsSection(tools)).toMatchSnapshot();
  });
});

describe("formatSkillsSection", () => {
  it("returns empty string for empty list", () => {
    expect(formatSkillsSection([])).toMatchSnapshot();
  });

  it("groups skills by category", () => {
    const skills = [
      makeSkill("read-protocols-first", "protocols"),
      makeSkill("duckdb-json", "knowledge"),
      makeSkill("bash", "tools"),
      makeSkill("typescript-constraints", "protocols"),
    ];

    expect(formatSkillsSection(skills)).toMatchSnapshot();
  });

  it("skips category headers when only one group", () => {
    const skills = [
      makeSkill("skill-a", "protocols"),
      makeSkill("skill-b", "protocols"),
    ];

    expect(formatSkillsSection(skills)).toMatchSnapshot();
  });
});

describe("buildSystemPrompt", () => {
  it("includes static sections regardless of tools/skills", () => {
    const result = buildSystemPrompt([], []);
    expect(result).toMatchSnapshot();
  });

  it("includes tools section when tools exist", () => {
    const result = buildSystemPrompt(
      [{ name: "read", description: "Read files" }],
      [],
    );
    expect(result).toMatchSnapshot();
  });

  it("includes skills section when skills exist", () => {
    const result = buildSystemPrompt([], [makeSkill("my-skill", "knowledge")]);
    expect(result).toMatchSnapshot();
  });

  it("includes both dynamic and static sections together", () => {
    const result = buildSystemPrompt(
      [{ name: "read", description: "Read files" }],
      [makeSkill("my-skill", "knowledge")],
    );
    expect(result).toMatchSnapshot();
  });
});
