import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const skillsBase = join(homedir(), ".pi", "agent", "skills");
export const skillsBaseTilde = `~/${relative(homedir(), skillsBase)}`;
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
  tokenCost: number;
  topic: string;
  keywords: string[];
  requiresTools: string[];
  related: string[];
  description: string;
  commandPatterns: string[];
  excludeCommandPatterns: string[];
}

// ── Directory resolution ───────────────────────────────────────────────

function addIfExists(dirs: string[], path: string): void {
  if (existsSync(path)) dirs.push(path);
}

function getSkillDirs(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, "..", "..");
  const dirs: string[] = [];

  const builtinSkills = join(repoRoot, "agent", "skills");
  if (existsSync(builtinSkills)) {
    for (const sub of ["tools", "knowledge", "protocols"]) {
      addIfExists(dirs, join(builtinSkills, sub));
    }
  }

  addIfExists(dirs, join(homedir(), ".pi", "agent", "skills"));
  addIfExists(dirs, join(repoRoot, ".pi", "skills"));

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

function parseFrontmatter(
  fm: Record<string, unknown>,
  rawName: string,
  mdPath: string,
): Omit<SkillEntry, "path" | "body" | "size" | "lineCount" | "lastModified"> {
  const explicitTargetTool = safeString(fm.target_tool);
  const isInToolsDir = mdPath.includes("/tools/");
  return {
    name: rawName,
    targetTool: explicitTargetTool || (isInToolsDir ? rawName : null),
    topic: safeString(fm.topic) || rawName,
    keywords: safeStringArray(fm.keywords).map((k) =>
      typeof k === "string" ? k.toLowerCase() : "",
    ),
    requiresTools: safeStringArray(fm.requires_tools),
    related: safeStringArray(fm.related),
    description: safeString(fm.description),
    tokenCost: safeNumber(fm.token_cost, 150),
    commandPatterns: safeStringArray(fm.command_pattern),
    excludeCommandPatterns: safeStringArray(fm.exclude_command_pattern),
  };
}

function parseSkillEntry(mdPath: string): SkillEntry | null {
  try {
    const stat = statSync(mdPath);
    if (!stat.isFile()) return null;

    const content = readFileSync(mdPath, "utf-8");
    const parsed = parseSkillFile(content);
    if (!parsed) return null;

    const rawName = safeString(parsed.frontmatter.name);
    if (!rawName) return null;

    const body = parsed.body;

    return {
      path: relative(skillsBase, mdPath),
      body,
      size: stat.size,
      lineCount: body.split("\n").length,
      lastModified: stat.mtimeMs,
      ...parseFrontmatter(parsed.frontmatter, rawName, mdPath),
    };
  } catch {
    return null;
  }
}

// ── Registry class ─────────────────────────────────────────────────────

class SkillRegistry {
  private skills = new Map<string, SkillEntry>();
  private byTool = new Map<string, SkillEntry[]>();
  private keywordIndex = new Map<string, SkillEntry[]>();
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    this.loaded = true;

    this.skills.clear();
    this.byTool.clear();
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
    this.indexByTool(entry);
    this.indexKeywords(entry);
  }

  private indexByTool(entry: SkillEntry): void {
    if (!entry.targetTool) return;
    const list = this.byTool.get(entry.targetTool) ?? [];
    list.push(entry);
    this.byTool.set(entry.targetTool, list);
  }

  private indexKeywords(entry: SkillEntry): void {
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

  // Full-text search across all skill content
  // Look up a skill by its file path
  getByPath(path: string): SkillEntry | undefined {
    this.load();
    const lower = path.toLowerCase();
    const relLower = relative(skillsBase, path).toLowerCase();
    for (const skill of this.skills.values()) {
      if (
        skill.path.toLowerCase() === lower ||
        skill.path.toLowerCase() === relLower
      ) {
        return skill;
      }
    }
    return undefined;
  }

  // Total count
  get size(): number {
    this.load();
    return this.skills.size;
  }
}

// Singleton instance
export const registry = new SkillRegistry();
