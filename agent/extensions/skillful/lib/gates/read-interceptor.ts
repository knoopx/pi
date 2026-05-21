import { registry } from "../skills-registry";
import { tracker } from "../session-tracker";

/**
 * Intercept read calls targeting SKILL.md — mark as read so sibling tool
 * checks in the same preflight batch see the updated state.
 */
export function interceptReadCall(input: { path?: string }): void {
  const path = input.path ?? "";
  if (!path.includes("SKILL.md")) return;

  const skill = registry.getByPath(path) ?? tracker.isSkillRead(path);
  if (skill) {
    tracker.markRead(typeof skill === "string" ? skill : skill.name);
  }
}
