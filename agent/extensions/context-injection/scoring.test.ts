import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillFile } from "../../shared/skill-frontmatter";
import {
  findSkillDirs,
  forEachSkillFile,
} from "../../shared/testing/test-utils";
import { scoreKeywords } from "./index";

describe("knowledge entry scoring", () => {
  it("scores single word matches at 1.0 each", () => {
    expect(scoreKeywords("find the bucket", ["bucket"])).toBe(1.0);
    expect(scoreKeywords("find the bucket and pour", ["bucket", "pour"])).toBe(
      2.0,
    );
  });

  it("scores bigram/phrase matches at 2.0 each", () => {
    expect(scoreKeywords("minimum moves to solve", ["minimum moves"])).toBe(
      2.0,
    );
    expect(scoreKeywords("state space search", ["state space"])).toBe(2.0);
  });

  it("combines word + bigram scores", () => {
    const kw = ["bucket", "minimum moves", "pour"];
    // "bucket" word (1.0) + "minimum moves" phrase (2.0) + "pour" word (1.0) = 4.0
    expect(
      scoreKeywords("bucket pouring problem with minimum moves and pour", kw),
    ).toBe(4.0);
  });

  it("does not match partial words", () => {
    expect(scoreKeywords("many buckets here", ["bucket"])).toBe(0);
  });

  it("threshold at 2.0 requires at least two signals", () => {
    expect(scoreKeywords("find bucket", ["bucket", "pour"])).toBeLessThan(2.0);
    expect(
      scoreKeywords("bucket pour together", ["bucket", "pour"]),
    ).toBeGreaterThanOrEqual(2.0);
  });

  it("description scoring adds bonus for matching words", () => {
    expect(scoreKeywords("dynamic programming", ["dynamic programming"])).toBe(
      2.0,
    );
  });
});

describe("knowledge directory loads from repo", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const kDir = join(here, "..", "..", "skills", "knowledge");
  const pDir = join(here, "..", "..", "skills", "protocols");

  it("knowledge dir exists and has skill directories", () => {
    expect(existsSync(kDir)).toBe(true);
    expect(findSkillDirs(kDir).length).toBeGreaterThanOrEqual(20);
  });

  it("protocols dir has 6 skill directories", () => {
    expect(existsSync(pDir)).toBe(true);
    expect(findSkillDirs(pDir).length).toBe(6);
  });

  it("every knowledge entry has name in frontmatter", () => {
    forEachSkillFile(kDir, (parsed) => {
      expect(typeof parsed.frontmatter.name).toBe("string");
    });
  });

  it("workspace-docs declares requires_tools", () => {
    const parsed = parseSkillFile(
      readFileSync(join(kDir, "workspace-docs", "SKILL.md"), "utf-8"),
    );
    expect(parsed!.frontmatter.requires_tools).toEqual(["read", "find"]);
  });
});
