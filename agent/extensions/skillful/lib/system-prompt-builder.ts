import type { SkillEntry } from "./skills-registry";
import { agentWorkflow, introSection } from "./prompt-sections";

// Format tools for the "Available tools" section.
export function formatToolsSection(
  tools: Array<{ name: string; description?: string }>,
): string {
  if (tools.length === 0) return "";

  const lines = tools
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => `- ${t.name}: ${t.description}`);

  return `Available tools:\n\n${lines.join("\n")}`;
}

// Format skills for the "Available skills" section.
const GROUP_ORDER = ["Protocols", "Knowledge", "Tool Skills", "other"] as const;

function classifySkill(skill: SkillEntry): string {
  if (skill.path.includes("/protocols/")) return "Protocols";
  if (skill.path.includes("/knowledge/")) return "Knowledge";
  if (skill.path.includes("/tools/")) return "Tool Skills";
  return "other";
}

function formatSkillEntry(skill: SkillEntry): string {
  return `- **${skill.name}**: ${skill.description || ""}`;
}

export function formatSkillsSection(skills: SkillEntry[]): string {
  if (skills.length === 0) return "";

  const groups = groupBy(skills, classifySkill);
  const multiGroup = Object.keys(groups).length > 1;
  const lines: string[] = [];

  for (const group of GROUP_ORDER) {
    const entries = groups[group];
    if (!entries?.length) continue;

    if (multiGroup) {
      lines.push(`### ${group}`);
      lines.push("");
    }

    for (const skill of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(formatSkillEntry(skill));
    }
    lines.push("");
  }

  return `# Available Skills\n\n${lines.join("\n").trim()}`;
}

function groupBy<T>(items: T[], fn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = fn(item);
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
  }
  return groups;
}

// Build the full system prompt: intro, dynamic tools + skills, static guidelines, pi docs, workflow.
export function buildSystemPrompt(
  tools: Array<{ name: string; description?: string }>,
  skills: SkillEntry[],
): string {
  const parts: string[] = [];

  parts.push(introSection);

  const toolsSection = formatToolsSection(tools);
  if (toolsSection) parts.push(toolsSection);

  const skillsSection = formatSkillsSection(skills);
  if (skillsSection) parts.push(skillsSection);

  parts.push(agentWorkflow);

  return parts.join("\n\n");
}
