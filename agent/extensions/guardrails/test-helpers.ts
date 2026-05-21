import { matchCommandPattern } from "../../shared/matching/command-match";
import {
  matchContentPattern,
  matchFileNamePattern,
} from "../../shared/matching/pattern";
import type { GuardrailsGroup } from "./types";

function getGroup(defaults: GuardrailsGroup[], name: string): GuardrailsGroup {
  const group = defaults.find((g) => g.group === name);
  if (!group) throw new Error(`Group not found: ${name}`);
  return group;
}

function commandMatchesRule<
  Rule extends { pattern: string; includes?: string; excludes?: string },
>(command: string, rule: Rule): boolean {
  if (!matchCommandPattern(command, rule.pattern)) return false;
  if (rule.includes && !matchCommandPattern(command, rule.includes))
    return false;
  if (rule.excludes && matchCommandPattern(command, rule.excludes))
    return false;
  return true;
}

export function commandGroupMatches(
  defaults: GuardrailsGroup[],
  groupName: string,
  command: string,
): boolean {
  const group = getGroup(defaults, groupName);
  type Rule = (typeof defaults)[number]["rules"][number];
  return group.rules
    .filter((r: Rule) => r.context === "command")
    .some((r: Rule) => commandMatchesRule(command, r));
}

export function fileContentGroupMatches(
  defaults: GuardrailsGroup[],
  groupName: string,
  content: string,
): boolean {
  const group = getGroup(defaults, groupName);
  type Rule = (typeof defaults)[number]["rules"][number];
  return group.rules
    .filter((r: Rule) => r.context === "file_content")
    .some((r: Rule) => matchContentPattern(content, r.pattern));
}

export function fileNameGroupMatches(
  defaults: GuardrailsGroup[],
  groupName: string,
  filePath: string,
): boolean {
  const group = getGroup(defaults, groupName);
  type Rule = (typeof defaults)[number]["rules"][number];
  return group.rules
    .filter((r: Rule) => r.context === "file_name")
    .some((r: Rule) => {
      if (!matchFileNamePattern(filePath, r.pattern)) return false;
      if (r.excludes && matchFileNamePattern(filePath, r.excludes))
        return false;
      return true;
    });
}
