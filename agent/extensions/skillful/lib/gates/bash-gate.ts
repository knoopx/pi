import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchCommandPattern } from "../../../../shared/matching/command-match";
import { registry, skillsBaseTilde } from "../skills-registry";
import { tracker } from "../session-tracker";

export interface BashBlockResult {
  block: true;
  reason: string;
}

/**
 * Check a bash command against all skill command_patterns. If any unread
 * skill matches, return a block result with the full resolved paths.
 */
export function checkBashCommand(
  input: { command?: string; bash?: string },
  _ctx: ExtensionContext,
): BashBlockResult | undefined {
  const command = input.command ?? input.bash ?? "";
  if (!command) return;

  const unreadSkills = findUnreadSkillMatches(command);
  if (unreadSkills.length === 0) return;

  const paths = unreadSkills
    .map((s) => `${skillsBaseTilde}/${s.path}`)
    .join(", ");
  const reason = `Read ${paths} before running this command.`;

  return { block: true, reason };
}

function findUnreadSkillMatches(
  command: string,
): Array<{ name: string; path: string }> {
  const unread: Array<{ name: string; path: string }> = [];
  for (const skill of registry.getAll()) {
    if (isExcluded(skill, command)) continue;
    if (matchesPatterns(skill, command) && !tracker.isRead(skill)) {
      unread.push({ name: skill.name, path: skill.path });
    }
  }
  return unread;
}

function isExcluded(
  skill: ReturnType<typeof registry.getAll>[number],
  command: string,
): boolean {
  return skill.excludeCommandPatterns.some((p) =>
    matchCommandPattern(command, p),
  );
}

function matchesPatterns(
  skill: ReturnType<typeof registry.getAll>[number],
  command: string,
): boolean {
  return skill.commandPatterns.some((p) => matchCommandPattern(command, p));
}
