import type { SkillEntry } from "../../shared/skills-registry";

function scoreSkillKeywords(
  words: Set<string>,
  keywords: string[],
  description?: string,
): number {
  let score = 0;
  for (const keyword of keywords) {
    if (words.has(keyword.toLowerCase())) score++;
  }
  if (!description) return score;
  const descWords = new Set(
    description.toLowerCase().split(/\s+/).filter(Boolean),
  );
  for (const word of words) {
    if (word.length > 3 && descWords.has(word)) {
      score += 0.3;
    }
  }
  return score;
}

// Predict which skills are relevant by matching prompt words against
// skill keywords + description. Returns skill names (not tool names)
// so the correct variant is selected when multiple skills share a tool.
// Only returns skills whose tool is currently active.
export function predictTools(
  userText: string,
  toolSkills: SkillEntry[],
  activeTools: Set<string>,
): string[] {
  const words = new Set(userText.toLowerCase().split(/\s+/).filter(Boolean));
  const predicted = new Map<string, number>();

  for (const skill of toolSkills) {
    if (!skill.targetTool || !activeTools.has(skill.targetTool)) continue;
    const score = scoreSkillKeywords(
      words,
      skill.keywords ?? [],
      skill.description,
    );
    if (score > 0) {
      const existing = predicted.get(skill.name) ?? 0;
      predicted.set(skill.name, Math.max(existing, score));
    }
  }

  return [...predicted.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

// Detect CLI commands mentioned in the prompt and return matching
// tool skills. CLI tools run via bash so they don't need to be in
// activeTools — just match the tool name against prompt.
export function detectCliTools(
  userText: string,
  toolSkills: SkillEntry[],
): SkillEntry[] {
  const words = new Set(userText.toLowerCase().split(/\s+/).filter(Boolean));
  const matched: SkillEntry[] = [];

  for (const skill of toolSkills) {
    const cliName = skill.targetTool?.toLowerCase();
    if (!cliName) continue;
    // Also check skill name segments: "jj-core" matches "jj" or "core"
    const nameLower = skill.name.toLowerCase();
    const nameSegments = nameLower.split("-");
    if (
      words.has(cliName) ||
      words.has(nameLower) ||
      nameSegments.some((seg) => words.has(seg))
    ) {
      matched.push(skill);
    }
  }

  return matched;
}
