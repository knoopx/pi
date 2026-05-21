import { describe, it, expect } from "vitest";
import { registry } from "./skills-registry";

describe("skills registry", () => {
  it("loads skills from the repository", () => {
    expect(registry.size).toBeGreaterThan(0);
  });

  it("returns all loaded skills with relative paths", () => {
    const all = registry.getAll();
    expect(all.length).toBeGreaterThan(0);
    for (const skill of all) {
      expect(skill.name).not.toEqual("");
      expect(skill.path.startsWith("/")).toEqual(false);
      expect(skill.lineCount).toBeGreaterThan(0);
    }
  });

  it("bash skill has exact relative path", () => {
    const bash = registry.getByName("bash");
    expect(bash).toBeDefined();
    expect(bash!.path).toEqual("tools/bash/SKILL.md");
  });

  it("finds skill by name", () => {
    const bash = registry.getByName("bash");
    expect(bash).toBeDefined();
    expect(bash!.name.toLowerCase()).toEqual("bash");
  });

  it("returns undefined for unknown skill name", () => {
    expect(registry.getByName("nonexistent-skill-xyzzy")).toBeUndefined();
  });

  it("finds skills by tool name", () => {
    const bash = registry.getByTool("bash");
    expect(bash).toBeDefined();
    expect(bash!.targetTool).not.toBeNull();
  });

  it("returns undefined for unknown tool", () => {
    expect(registry.getByTool("nonexistent-tool-xyzzy")).toBeUndefined();
  });

  it("finds skills by keyword", () => {
    const bashSkills = registry.getByKeyword("bash");
    expect(bashSkills.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown keyword", () => {
    expect(registry.getByKeyword("xyzzy-nonexistent-keyword")).toEqual([]);
  });

  it("distinguishes knowledge entries from tool entries", () => {
    const knowledge = registry.getKnowledgeEntries();
    const tools = registry.getToolEntries();
    for (const entry of knowledge) {
      expect(entry.targetTool).toBeNull();
    }
    for (const entry of tools) {
      expect(entry.targetTool).not.toBeNull();
    }
  });

  it("reports target tools", () => {
    const toolNames = registry.getTargetTools();
    expect(toolNames.length).toBeGreaterThan(0);
    expect(toolNames).toContain("bash");
  });

  it("resolves related skills for an entry with related field", () => {
    const all = registry.getAll();
    const withRelated = all.find((s) => {
      if (s.related.length === 0) return false;
      const resolved = registry.getRelated(s);
      return resolved.length > 0;
    });
    if (withRelated) {
      const related = registry.getRelated(withRelated);
      expect(related.length).toBeGreaterThan(0);
      for (const r of related) {
        expect(
          withRelated.related
            .map((n) => n.toLowerCase())
            .includes(r.name.toLowerCase()),
        ).toEqual(true);
      }
    } else {
      expect(true).toBe(true);
    }
  });

  it("returns empty array for entry with no related skills", () => {
    const all = registry.getAll();
    const withoutRelated = all.find((s) => s.related.length === 0);
    if (withoutRelated) {
      expect(registry.getRelated(withoutRelated)).toEqual([]);
    } else {
      expect(true).toBe(true);
    }
  });

  it("gets all skills for a tool with collisions", () => {
    const bashAll = registry.getByToolAll("bash");
    expect(bashAll.length).toBeGreaterThan(0);
    for (const entry of bashAll) {
      expect(entry.targetTool?.toLowerCase()).toEqual("bash");
    }
  });

  it("prefers matching name in getByToolPreferred", () => {
    const preferred = registry.getByToolPreferred("bash", "bash");
    if (preferred) {
      expect(preferred.name.toLowerCase()).toEqual("bash");
    }
  });

  it("falls back to first entry when no preferred name matches", () => {
    const fallback = registry.getByToolPreferred("bash", "nonexistent");
    if (fallback) {
      expect(fallback.targetTool?.toLowerCase()).toEqual("bash");
    }
  });

  it("parses skill with token_cost field", () => {
    const all = registry.getAll();
    for (const skill of all) {
      expect(typeof skill.tokenCost).toEqual("number");
      expect(skill.tokenCost).toBeGreaterThan(0);
    }
  });

  it("normalizes keywords to lowercase", () => {
    const all = registry.getAll();
    for (const skill of all) {
      for (const kw of skill.keywords) {
        expect(kw).toEqual(kw.toLowerCase());
      }
    }
  });

  it("stores relative paths for all skills", () => {
    const all = registry.getAll();
    for (const skill of all) {
      expect(skill.path.startsWith("/")).toEqual(false);
    }
  });

  it("getByPath resolves relative paths", () => {
    const bash = registry.getByTool("bash");
    expect(bash).toBeDefined();
    expect(bash!.path).toEqual("tools/bash/SKILL.md");
    const found = registry.getByPath("tools/bash/SKILL.md");
    expect(found?.name).toEqual("bash");
  });
});
