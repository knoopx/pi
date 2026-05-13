import type { GuardrailsGroup, GuardrailsRule } from "../types";
import {
  getInputFieldAsString,
  matchesPattern,
  checkFilePatternMatch,
  passesScopeCheck,
  isGroupActive,
} from "./checking";

export interface MatchedRule {
  rule: GuardrailsRule;
  group: GuardrailsGroup;
  targetValue: string;
}

function matchCommandRule(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
): { targetValue: string } | null {
  if (toolName !== "bash") return null;
  const command = getInputFieldAsString(input, "command");
  if (!command) return null;
  if (!matchesPattern(rule.context, command, rule.pattern)) return null;
  return { targetValue: command };
}

function getFileTargetValue(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
  filePath: string | undefined,
): string | undefined {
  if (rule.context === "file_name" && ["edit", "write"].includes(toolName))
    return filePath;
  if (rule.context === "file_content" && toolName === "edit")
    return getInputFieldAsString(input, "newText");
  if (rule.context === "file_content" && toolName === "write")
    return getInputFieldAsString(input, "content");
  return undefined;
}

function matchRule(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
  cwd: string,
): { targetValue: string } | null {
  if (rule.context === "command")
    return matchCommandRule(rule, toolName, input);
  const filePath = getInputFieldAsString(input, "path");
  if (!checkFilePatternMatch(filePath, rule.file_pattern)) return null;
  if (!passesScopeCheck(rule, filePath, cwd)) return null;
  const targetValue = getFileTargetValue(rule, toolName, input, filePath);
  if (!targetValue) return null;

  if (!matchesPattern(rule.context, targetValue, rule.pattern)) return null;
  return { targetValue };
}

function shouldIncludeRule(rule: GuardrailsRule, targetValue: string): boolean {
  if (
    rule.includes &&
    !matchesPattern(rule.context, targetValue, rule.includes)
  )
    return false;

  if (rule.excludes && matchesPattern(rule.context, targetValue, rule.excludes))
    return false;

  return true;
}

async function processGroupRules(
  group: GuardrailsGroup,
  toolName: string,
  input: unknown,
  cwd: string,
): Promise<MatchedRule[]> {
  const matched: MatchedRule[] = [];
  const isActive = await isGroupActive(
    group.pattern,
    cwd,
    group.excludePattern,
  );
  if (!isActive) return matched;

  for (const rule of group.rules) {
    try {
      const matchResult = matchRule(rule, toolName, input, cwd);
      if (!matchResult) continue;
      const { targetValue } = matchResult;
      if (!shouldIncludeRule(rule, targetValue)) continue;

      matched.push({ rule, group, targetValue });
    } catch {
      continue;
    }
  }

  return matched;
}

export async function findMatchingRules(
  toolName: string,
  input: unknown,
  config: GuardrailsGroup[],
  cwd: string,
): Promise<MatchedRule[]> {
  const matched: MatchedRule[] = [];

  for (const group of config) {
    const groupMatches = await processGroupRules(group, toolName, input, cwd);
    matched.push(...groupMatches);
  }

  return matched;
}
