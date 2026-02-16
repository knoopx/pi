/**
 * Skills.sh API client
 *
 * Uses the official skills.sh API endpoints and local filesystem
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const SKILLS_API_BASE = "https://skills.sh";

export interface RemoteSkill {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string;
}

export interface SkillFile {
  name: string;
  path: string;
  downloadUrl: string;
  size: number;
}

interface SearchResponse {
  query: string;
  skills: RemoteSkill[];
  count: number;
}

interface GitHubContent {
  name: string;
  path: string;
  download_url: string;
  size: number;
  type: string;
}

/**
 * Search skills via the API
 */
export async function searchSkills(
  query: string,
  limit = 50,
): Promise<RemoteSkill[]> {
  const url = `${SKILLS_API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data = (await response.json()) as SearchResponse;
  return data.skills;
}

/**
 * Fetch hot/trending skills
 */
export async function fetchHotSkills(): Promise<RemoteSkill[]> {
  const response = await fetch(`${SKILLS_API_BASE}/hot`);

  if (!response.ok) {
    throw new Error(`Failed to fetch hot skills: ${response.statusText}`);
  }

  const html = await response.text();

  // Parse the embedded JSON from the Next.js page
  const skills: RemoteSkill[] = [];
  const pattern =
    /\\"source\\":\\"([^"\\]+)\\",\\"skillId\\":\\"([^"\\]+)\\",\\"name\\":\\"([^"\\]+)\\",\\"installs\\":(\d+)/g;

  let match;
  const seen = new Set<string>();

  while ((match = pattern.exec(html)) !== null) {
    const [, source, skillId, name, installs] = match;
    const id = `${source}/${skillId}`;

    if (!seen.has(id)) {
      seen.add(id);
      skills.push({
        id,
        skillId,
        name,
        installs: parseInt(installs, 10),
        source,
      });
    }
  }

  return skills.sort((a, b) => b.installs - a.installs);
}

/**
 * Generate skill ID variants (some repos prefix/suffix skill names)
 */
function getSkillIdVariants(skillId: string, owner: string): string[] {
  const variants = [skillId];

  // Remove owner prefix if present (e.g., "vercel-react-best-practices" -> "react-best-practices")
  const ownerPrefix = owner.split("-")[0] + "-";
  if (skillId.startsWith(ownerPrefix)) {
    variants.push(skillId.slice(ownerPrefix.length));
  }

  // Remove common suffixes/prefixes
  if (skillId.endsWith("-skill")) {
    variants.push(skillId.slice(0, -6));
  }
  if (skillId.endsWith("-best-practices")) {
    variants.push(skillId.replace("-best-practices", ""));
  }

  return [...new Set(variants)];
}

/**
 * Common skill directory paths to try
 */
function getSkillPaths(owner: string, repo: string, skillId: string): string[] {
  const variants = getSkillIdVariants(skillId, owner);
  const paths: string[] = [];

  for (const variant of variants) {
    paths.push(
      `https://api.github.com/repos/${owner}/${repo}/contents/.claude/skills/${variant}`,
      `https://api.github.com/repos/${owner}/${repo}/contents/skills/${variant}`,
      `https://api.github.com/repos/${owner}/${repo}/contents/${variant}`,
    );
  }

  return paths;
}

/**
 * Fetch list of files in a skill directory
 */
export async function fetchSkillFiles(
  skill: RemoteSkill,
): Promise<SkillFile[]> {
  const [owner, repo] = skill.source.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid source: ${skill.source}`);
  }

  const paths = getSkillPaths(owner, repo, skill.skillId);

  for (const url of paths) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as GitHubContent[];
        if (Array.isArray(data)) {
          return data
            .filter((item) => item.type === "file")
            .map((item) => ({
              name: item.name,
              path: item.path,
              downloadUrl: item.download_url,
              size: item.size,
            }));
        }
      }
    } catch {
      // Try next path
    }
  }

  // Fallback: try to find SKILL.md directly
  const fallbackFiles = await tryFindSkillMd(owner, repo, skill.skillId);
  if (fallbackFiles.length > 0) {
    return fallbackFiles;
  }

  throw new Error(`Could not find skill directory for ${skill.id}`);
}

/**
 * Try to find SKILL.md file directly
 */
async function tryFindSkillMd(
  owner: string,
  repo: string,
  skillId: string,
): Promise<SkillFile[]> {
  const variants = getSkillIdVariants(skillId, owner);
  const paths: string[] = [];

  for (const variant of variants) {
    paths.push(
      `.claude/skills/${variant}.md`,
      `skills/${variant}/SKILL.md`,
      `skills/${variant}.md`,
      `${variant}/SKILL.md`,
      `${variant}.md`,
    );
  }

  for (const branch of ["main", "master"]) {
    for (const path of paths) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      try {
        const response = await fetch(url, { method: "HEAD" });
        if (response.ok) {
          const name = path.split("/").pop() || "SKILL.md";
          return [
            {
              name,
              path,
              downloadUrl: url,
              size: 0,
            },
          ];
        }
      } catch {
        // Try next
      }
    }
  }

  return [];
}

/**
 * Fetch file content by URL
 */
export async function fetchFileContent(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  return await response.text();
}

/**
 * Format install count for display
 */
export function formatInstalls(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

/**
 * Format file size for display
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${bytes}B`;
}

// ============================================================================
// Local Skills
// ============================================================================

export interface LocalSkill {
  name: string;
  description: string;
  path: string;
}

export interface LocalFile {
  name: string;
  path: string;
  size: number;
}

/**
 * Discover local skills in agent/skills directory
 */
export async function discoverLocalSkills(cwd: string): Promise<LocalSkill[]> {
  const skillsDir = join(cwd, "agent", "skills");
  const skills: LocalSkill[] = [];

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = join(skillsDir, entry.name);
      const skillMdPath = join(skillPath, "SKILL.md");

      try {
        const content = await readFile(skillMdPath, "utf-8");
        const { name, description } = parseSkillFrontmatter(
          content,
          entry.name,
        );
        skills.push({ name, description, path: skillPath });
      } catch {
        // No SKILL.md, skip
      }
    }
  } catch {
    // Skills directory doesn't exist
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parse SKILL.md frontmatter for name and description
 */
function parseSkillFrontmatter(
  content: string,
  fallbackName: string,
): { name: string; description: string } {
  let name = fallbackName;
  let description = "";

  if (content.startsWith("---")) {
    const endIdx = content.indexOf("---", 3);
    if (endIdx !== -1) {
      const frontmatter = content.slice(3, endIdx);
      const nameMatch = /^name:\s*(.+)$/m.exec(frontmatter);
      if (nameMatch) name = nameMatch[1].trim();
      const descMatch = /^description:\s*(.+)$/m.exec(frontmatter);
      if (descMatch) description = descMatch[1].trim();
    }
  }

  // Fallback: extract from first heading
  if (!description) {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
        description = trimmed.slice(0, 80);
        break;
      }
    }
  }

  return { name, description };
}

/**
 * Get files in a local skill directory
 */
export async function getLocalSkillFiles(
  skillPath: string,
): Promise<LocalFile[]> {
  const files: LocalFile[] = [];

  try {
    const entries = await readdir(skillPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const filePath = join(skillPath, entry.name);
      const stats = await stat(filePath);
      files.push({
        name: entry.name,
        path: filePath,
        size: stats.size,
      });
    }
  } catch {
    // Error reading directory
  }

  // Sort: SKILL.md first, then alphabetically
  return files.sort((a, b) => {
    if (a.name === "SKILL.md") return -1;
    if (b.name === "SKILL.md") return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Read local file content
 */
export async function readLocalFile(filePath: string): Promise<string> {
  return await readFile(filePath, "utf-8");
}
