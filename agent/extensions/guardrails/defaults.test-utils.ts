import defaults from "./defaults.json";
import type { GuardrailsConfig } from "./config";
import { matchCommandPattern } from "./command-parser";
import { describe } from "vitest";

export const typedDefaults = defaults as GuardrailsConfig;

export function groupMatches(groupName: string, command: string): boolean {
  const group = typedDefaults.find((g) => g.group === groupName);
  if (!group) throw new Error(`Group not found: ${groupName}`);
  return group.rules
    .filter((r) => r.context === "command")
    .some((r) => {
      if (!matchCommandPattern(command, r.pattern)) return false;
      if (r.includes && !matchCommandPattern(command, r.includes)) return false;
      if (r.excludes && matchCommandPattern(command, r.excludes)) return false;
      return true;
    });
}

export function regexGroupMatches(groupName: string, value: string): boolean {
  const group = typedDefaults.find((g) => g.group === groupName);
  if (!group) throw new Error(`Group not found: ${groupName}`);
  return group.rules.some((r) => new RegExp(r.pattern).test(value));
}

export function guardrailsDescribe(groupName: string, tests: () => void) {
  describe(`defaults.json - ${groupName} group`, tests);
}

export function getGroup(groupName: string): (typeof typedDefaults)[number] {
  const group = typedDefaults.find((g) => g.group === groupName);
  if (!group) throw new Error(`Group not found: ${groupName}`);
  return group;
}
