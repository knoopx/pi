import { skillsBaseTilde, type SkillEntry } from "../skills-registry";

export interface BlockResult {
  block: true;
  reason: string;
}

/**
 * Check whether a tool call should be blocked because its matching tool skill
 * has not been read yet.
 *
 * - `read` tool is always allowed — needed to load skills.
 * - No registered skill → always allowed.
 * - Skill HAS been read → allow.
 * - Skill has NOT been read → block.
 */
export function blockToolCall(
  toolName: string,
  skill: SkillEntry | undefined,
  isRead: (skill: { name: string }) => boolean,
): BlockResult | undefined {
  // Always allow read — needed to load skills in the first place.
  if (toolName === "read") return;

  if (!skill) return;

  if (!isRead(skill)) {
    return {
      block: true,
      reason: `Read ${skillsBaseTilde}/${skill.path} before using ${toolName}.`,
    };
  }
}
