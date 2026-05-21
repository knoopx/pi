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

function getFileNameTarget(
  rule: GuardrailsRule,
  toolName: string,
  filePath: string | undefined,
): string | undefined {
  if (rule.context === "file_name" && ["edit", "write"].includes(toolName))
    return filePath;
  return undefined;
}

function isFileContentContext(rule: GuardrailsRule): boolean {
  return rule.context === "file_content";
}

function getFileContentTarget(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
): string | undefined {
  if (!isFileContentContext(rule)) return undefined;
  if (toolName === "edit") return getInputFieldAsString(input, "newText");
  if (toolName === "write") return getInputFieldAsString(input, "content");
  return undefined;
}

function getFileTargetValue(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
  filePath: string | undefined,
): string | undefined {
  const fileNameResult = getFileNameTarget(rule, toolName, filePath);
  if (fileNameResult) return fileNameResult;
  return getFileContentTarget(rule, toolName, input);
}

function validateFilePath(
  filePath: string | undefined,
  rule: GuardrailsRule,
  cwd: string,
): boolean {
  if (!checkFilePatternMatch(filePath, rule.file_pattern)) return false;
  return passesScopeCheck(rule, filePath, cwd);
}

function matchesRulePattern(
  rule: GuardrailsRule,
  targetValue: string,
): boolean {
  return matchesPattern(rule.context, targetValue, rule.pattern);
}

function matchFileRule(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
  cwd: string,
): { targetValue: string } | null {
  const filePath = getInputFieldAsString(input, "path");
  if (!validateFilePath(filePath, rule, cwd)) return null;
  const targetValue = getFileTargetValue(rule, toolName, input, filePath);
  if (!targetValue) return null;
  if (!matchesRulePattern(rule, targetValue)) return null;
  return { targetValue };
}

function matchRule(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
  cwd: string,
): { targetValue: string } | null {
  if (rule.context === "command")
    return matchCommandRule(rule, toolName, input);
  return matchFileRule(rule, toolName, input, cwd);
}

function passesIncludeCheck(
  rule: GuardrailsRule,
  targetValue: string,
): boolean {
  if (!rule.includes) return true;
  return matchesPattern(rule.context, targetValue, rule.includes);
}

function shouldIncludeRule(rule: GuardrailsRule, targetValue: string): boolean {
  if (!passesIncludeCheck(rule, targetValue)) return false;
  if (rule.excludes && matchesPattern(rule.context, targetValue, rule.excludes))
    return false;
  return true;
}

function tryMatchSingleRule(
  rule: GuardrailsRule,
  group: GuardrailsGroup,
  toolName: string,
  input: unknown,
  cwd: string,
): MatchedRule | null {
  try {
    const matchResult = matchRule(rule, toolName, input, cwd);
    if (!matchResult) return null;
    const { targetValue } = matchResult;
    if (!shouldIncludeRule(rule, targetValue)) return null;
    return { rule, group, targetValue };
  } catch {
    return null;
  }
}

async function processGroupRules(
  group: GuardrailsGroup,
  toolName: string,
  input: unknown,
  cwd: string,
): Promise<MatchedRule[]> {
  const isActive = await isGroupActive(
    group.pattern,
    cwd,
    group.excludePattern,
  );
  if (!isActive) return [];

  const matched: MatchedRule[] = [];
  for (const rule of group.rules) {
    const result = tryMatchSingleRule(rule, group, toolName, input, cwd);
    if (result) matched.push(result);
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
