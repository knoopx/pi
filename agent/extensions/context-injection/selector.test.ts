import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillFile } from "../../shared/skill-frontmatter";
import type { SkillEntry } from "../../shared/skills-registry";
import {
  findSkillDirs,
  forEachSkillFile,
} from "../../shared/testing/test-utils";
import { predictTools, detectCliTools } from "./intent";

const makeSkill = (
  targetTool: string,
  keywords: string[],
  opts?: { description?: string; related?: string[] },
): SkillEntry => ({
  name: targetTool,
  path: `/fake/${targetTool}.md`,
  body: "",
  size: 0,
  lineCount: 0,
  lastModified: 0,
  targetTool,
  tokenCost: 0,
  topic: targetTool,
  keywords,
  requiresTools: [],
  related: opts?.related ?? [],
  description: opts?.description ?? "",
});

describe("intent prediction (frontmatter keywords)", () => {
  const toolSkills: SkillEntry[] = [
    makeSkill("read", ["read", "show", "view", "cat"]),
    makeSkill("edit", ["edit", "fix", "modify", "update"]),
    makeSkill("bash", ["run", "execute", "build", "test"]),
    makeSkill("find", ["find", "glob", "files"]),
    makeSkill("grep", ["search", "grep", "pattern"]),
    makeSkill("write", ["write", "create"]),
    makeSkill("evidence-add", ["cite", "evidence"]),
  ];
  const activeTools = new Set(
    toolSkills.flatMap((s) => (s.targetTool ? [s.targetTool] : [])),
  );

  it("predicts read for 'read config.py'", () => {
    expect(
      predictTools(
        "read config.py and show me the output",
        toolSkills,
        activeTools,
      ),
    ).toContain("read");
  });
  it("predicts edit for 'fix the bug'", () => {
    const p = predictTools(
      "please fix the bug in auth.py",
      toolSkills,
      activeTools,
    );
    expect(p).toContain("edit");
  });
  it("predicts bash for 'run the tests'", () => {
    const p = predictTools(
      "run the tests and build the project",
      toolSkills,
      activeTools,
    );
    expect(p).toContain("bash");
  });
  it("predicts find+grep for 'find all files'", () => {
    const p = predictTools(
      "find all files matching the pattern",
      toolSkills,
      activeTools,
    );
    expect(p).toContain("find");
    expect(p).toContain("grep");
  });
  it("empty predictions for neutral prompts", () => {
    expect(predictTools("hello there", toolSkills, activeTools)).toEqual([]);
  });
  it("drops tools not in active set", () => {
    const limited = new Set(["read", "edit"]);
    const p = predictTools("read and run tests", toolSkills, limited);
    expect(p).toContain("read");
    expect(p).not.toContain("bash");
  });
  it("returns skill names not tool names", () => {
    const p = predictTools("read file", toolSkills, activeTools);
    expect(p.every((n) => toolSkills.some((s) => s.name === n))).toBe(true);
  });

  it("boosts score from description match", () => {
    const skillsWithDesc: SkillEntry[] = [
      makeSkill("read", ["read"], {
        description:
          "Read file contents with line numbers for viewing source code",
      }),
      makeSkill("edit", ["edit"], {
        description:
          "Replace exact text in a file for modifying existing files",
      }),
    ];
    const active = new Set(["read", "edit"]);
    const p = predictTools("read source code", skillsWithDesc, active);
    expect(p).toContain("read");
  });

  it("description bonus does not trigger on short words", () => {
    const skillsWithDesc: SkillEntry[] = [
      makeSkill("read", ["read"], {
        description: "Read file with a b c",
      }),
    ];
    const active = new Set(["read"]);
    const p = predictTools("read a b c", skillsWithDesc, active);
    expect(p).toContain("read");
  });
});

describe("CLI tool detection", () => {
  const cliSkills: SkillEntry[] = [
    makeSkill("jj", ["jj", "jujutsu", "rebase", "commit"]),
    makeSkill("hx", ["helix", "hx", "editor", "keybinding"]),
    makeSkill("nu", ["nu", "nushell", "pipeline", "csv"]),
    makeSkill("nix", ["nix", "shell", "env", "package"]),
    makeSkill("sg", ["sg", "ast", "pattern", "refactor"]),
    makeSkill("grit", ["grit", "query", "refactor", "migrate"]),
  ];

  it("detects jj for 'jj rebase'", () => {
    const matched = detectCliTools("jj rebase -d main", cliSkills);
    expect(matched.map((s) => s.targetTool)).toContain("jj");
  });

  it("detects hx for 'edit with hx'", () => {
    const matched = detectCliTools("edit with hx file.ts", cliSkills);
    expect(matched.map((s) => s.targetTool)).toContain("hx");
  });

  it("detects multiple CLI tools", () => {
    const matched = detectCliTools("jj commit then hx edit", cliSkills);
    const tools = matched.map((s) => s.targetTool);
    expect(tools).toContain("jj");
    expect(tools).toContain("hx");
  });

  it("returns empty for no CLI matches", () => {
    const matched = detectCliTools("hello world", cliSkills);
    expect(matched).toEqual([]);
  });
});

describe("skills directory loads from repo", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const toolsDir = join(here, "..", "..", "skills", "tools");

  it("exists and has skill directories", () => {
    expect(existsSync(toolsDir)).toBe(true);
    expect(findSkillDirs(toolsDir).length).toBe(30);
  });

  it("every tool skill has name in frontmatter", () => {
    forEachSkillFile(toolsDir, (parsed) => {
      expect(typeof parsed.frontmatter.name).toBe("string");
    });
  });

  it("core tools are all represented", () => {
    const names = new Set<string>();
    for (const skillDir of findSkillDirs(toolsDir)) {
      const parsed = parseSkillFile(
        readFileSync(join(skillDir, "SKILL.md"), "utf-8"),
      );
      const n = parsed?.frontmatter.name;
      if (typeof n === "string") names.add(n);
    }
    for (const core of ["read", "write", "edit", "bash", "find", "grep"]) {
      expect(names.has(core), `expected name=${core}`).toBe(true);
    }
  });
});
