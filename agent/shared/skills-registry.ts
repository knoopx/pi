import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillFile } from "./skill-frontmatter";

// ── Parsed skill with full metadata ────────────────────────────────────

export interface SkillEntry {
  name: string;
  path: string;
  body: string;
  size: number;
  lineCount: number;
  lastModified: number;
  targetTool: string | null;
  triggers: string[]; // deprecated, use keywords
  tokenCost: number;
  topic: string;
  keywords: string[];
  requiresTools: string[];
  related: string[];
  description: string;
}

// ── Directory resolution ───────────────────────────────────────────────

function getSkillDirs(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, "..", "..");
  const dirs: string[] = [];

  // Built-in skills
  const builtinSkills = join(repoRoot, "agent", "skills");
  if (existsSync(builtinSkills)) {
    for (const sub of ["tools", "knowledge", "protocols"]) {
      const subDir = join(builtinSkills, sub);
      if (existsSync(subDir)) dirs.push(subDir);
    }
  }

  // User skills from agent directory
  const agentSkills = join(homedir(), ".pi", "agent", "skills");
  if (existsSync(agentSkills)) dirs.push(agentSkills);

  // Project-local skills
  const projectSkills = join(repoRoot, ".pi", "skills");
  if (existsSync(projectSkills)) dirs.push(projectSkills);

  return dirs;
}

// ── Parsing helpers ────────────────────────────────────────────────────

function safeString(val: unknown): string {
  return typeof val === "string" ? val : "";
}

function safeStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((s) => typeof s === "string");
  return [];
}

function safeNumber(val: unknown, fallback: number): number {
  return typeof val === "number" ? val : fallback;
}

function parseSkillEntry(mdPath: string): SkillEntry | null {
  try {
    const stat = statSync(mdPath);
    if (!stat.isFile()) return null;

    const content = readFileSync(mdPath, "utf-8");
    const parsed = parseSkillFile(content);
    if (!parsed) return null;

    const fm = parsed.frontmatter;
    const rawName = safeString(fm.name);
    if (!rawName) return null;
    const body = parsed.body;
    const lines = body.split("\n").length;

    // Infer target_tool from skill name for tools/ directory skills
    const explicitTargetTool = safeString(fm.target_tool);
    const isInToolsDir = mdPath.includes("/tools/");
    const targetTool = explicitTargetTool || (isInToolsDir ? rawName : "");
    const triggers = safeStringArray(fm.triggers);
    const topic = safeString(fm.topic) || rawName;
    const keywords = safeStringArray(fm.keywords).map((k) =>
      typeof k === "string" ? k.toLowerCase() : "",
    );
    const requiresTools = safeStringArray(fm.requires_tools);
    const related = safeStringArray(fm.related);
    const description = safeString(fm.description);

    return {
      name: rawName,
      path: mdPath,
      body,
      size: stat.size,
      lineCount: lines,
      lastModified: stat.mtimeMs,
      targetTool,
      triggers,
      tokenCost: safeNumber(fm.token_cost, 150),
      topic,
      keywords,
      requiresTools,
      related,
      description,
    };
  } catch {
    return null;
  }
}

// ── Registry class ─────────────────────────────────────────────────────

class SkillRegistry {
  private skills = new Map<string, SkillEntry>();
  private byTool = new Map<string, SkillEntry[]>();
  private byTrigger = new Map<string, SkillEntry[]>();
  private keywordIndex = new Map<string, SkillEntry[]>();
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    this.loaded = true;

    this.skills.clear();
    this.byTool.clear();
    this.byTrigger.clear();
    this.keywordIndex.clear();

    for (const dir of getSkillDirs()) {
      this.scanDir(dir);
    }
  }

  private scanDir(dir: string): void {
    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Every skill must be in its own directory with SKILL.md
          const skillMd = join(fullPath, "SKILL.md");
          if (existsSync(skillMd)) {
            this.addFile(skillMd);
          }
          // Recurse for nested reference files (not picked up as skills)
          this.scanDir(fullPath);
        }
      }
    } catch {
      // directory unreadable
    }
  }

  private addFile(path: string): void {
    const entry = parseSkillEntry(path);
    if (!entry) return;

    this.skills.set(entry.name, entry);

    if (entry.targetTool) {
      const list = this.byTool.get(entry.targetTool) ?? [];
      list.push(entry);
      this.byTool.set(entry.targetTool, list);
    }

    for (const trigger of entry.triggers) {
      const trigList = this.byTrigger.get(trigger) ?? [];
      trigList.push(entry);
      this.byTrigger.set(trigger, trigList);
    }

    for (const kw of entry.keywords) {
      if (!kw) continue;
      const kwList = this.keywordIndex.get(kw) ?? [];
      kwList.push(entry);
      this.keywordIndex.set(kw, kwList);
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────

  getAll(): SkillEntry[] {
    this.load();
    return [...this.skills.values()];
  }

  getByName(name: string): SkillEntry | undefined {
    this.load();
    return this.skills.get(name.toLowerCase());
  }

  getByTool(tool: string): SkillEntry | undefined {
    this.load();
    return this.byTool.get(tool)?.[0];
  }

  // Get all skills for a tool (handles collisions like nix + nix-flakes)
  getByToolAll(tool: string): SkillEntry[] {
    this.load();
    return this.byTool.get(tool) ?? [];
  }

  // Resolve related skill names to entries
  getRelated(entry: SkillEntry): SkillEntry[] {
    this.load();
    return entry.related
      .map((name) => this.skills.get(name.toLowerCase()))
      .filter((e): e is SkillEntry => e !== undefined);
  }

  getByTrigger(trigger: string): SkillEntry[] {
    this.load();
    return this.byTrigger.get(trigger) ?? [];
  }

  getByKeyword(keyword: string): SkillEntry[] {
    this.load();
    return this.keywordIndex.get(keyword.toLowerCase()) ?? [];
  }

  searchByKeywords(keywords: string[]): SkillEntry[] {
    this.load();
    const matched = new Map<string, SkillEntry>();

    for (const kw of keywords) {
      const results = this.keywordIndex.get(kw.toLowerCase());
      if (results) {
        for (const entry of results) {
          matched.set(entry.name, entry);
        }
      }
    }

    return [...matched.values()];
  }

  // Get knowledge/protocol entries (has keywords, no target_tool)
  getKnowledgeEntries(): SkillEntry[] {
    this.load();
    return this.getAll().filter((s) => s.keywords.length > 0 && !s.targetTool);
  }

  // Get tool skills (skills in tools/ directory, target_tool inferred from name)
  getToolEntries(): SkillEntry[] {
    this.load();
    return this.getAll().filter((s) => s.targetTool);
  }

  getTargetTools(): string[] {
    this.load();
    return [...this.byTool.keys()];
  }

  // Get all skills for a tool, preferring the one with matching name
  getByToolPreferred(
    tool: string,
    preferredName?: string,
  ): SkillEntry | undefined {
    this.load();
    const all = this.byTool.get(tool);
    if (!all) return undefined;
    if (all.length === 1) return all[0];
    // Prefer the skill whose name matches the hint
    if (preferredName) {
      const match = all.find(
        (s) => s.name.toLowerCase() === preferredName.toLowerCase(),
      );
      if (match) return match;
    }
    return all[0];
  }

  // Total count
  get size(): number {
    this.load();
    return this.skills.size;
  }
}

// ── Trigger validation ──────────────────────────────────────────────────

export interface TriggerIssue {
  skill: string;
  trigger: string;
  problem: string;
}

const TRIGGER_PATTERN = /^[a-z][a-z0-9-]*$/;

function validateKeyword(
  keyword: string,
  skillName: string,
  seen: Set<string>,
  allKeywords: Map<string, string[]>,
  issues: TriggerIssue[],
): void {
  if (!TRIGGER_PATTERN.test(keyword)) {
    issues.push({
      skill: skillName,
      trigger: keyword,
      problem: `keyword does not match pattern ^[a-z][a-z0-9-]*$`,
    });
    return;
  }
  if (seen.has(keyword)) {
    issues.push({
      skill: skillName,
      trigger: keyword,
      problem: `duplicate keyword within skill`,
    });
  }
  seen.add(keyword);
  const existing = allKeywords.get(keyword) ?? [];
  if (existing.length > 0) {
    issues.push({
      skill: skillName,
      trigger: keyword,
      problem: `keyword shared with: ${existing.join(", ")}`,
    });
  }
  existing.push(skillName);
  allKeywords.set(keyword, existing);
}

export function validateTriggers(skills: SkillEntry[]): TriggerIssue[] {
  const issues: TriggerIssue[] = [];
  const allKeywords = new Map<string, string[]>();

  for (const skill of skills) {
    if (skill.targetTool && skill.keywords.length === 0) {
      issues.push({
        skill: skill.name,
        trigger: "",
        problem: `tool skill has no keywords`,
      });
      continue;
    }
    const seen = new Set<string>();
    for (const keyword of skill.keywords) {
      validateKeyword(keyword, skill.name, seen, allKeywords, issues);
    }
  }

  return issues;
}

// Singleton instance
export const registry = new SkillRegistry();
