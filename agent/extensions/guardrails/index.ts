import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  configLoader,
  loadGuardrailsSettings,
  saveGuardrailsSettings,
} from "./config";
import type { GuardrailsGroup, GuardrailsRule, ResolvedConfig } from "./config";
import { matchCommandPattern } from "./command-parser";
import { glob } from "tinyglobby";

/**
 * Guardrails Extension
 *
 * Security hooks to prevent potentially dangerous operations.
 * Groups define file patterns and rules for blocking/confirming commands.
 * A group is activated if any file matching its pattern exists in the project.
 *
 * Configuration:
 * - Extension defaults: defaults.json (used when no global config exists)
 * - Global settings: ~/.pi/agent/settings.json under key "guardrails"
 */

function createGuardrailsHandler(ref: { value: boolean }) {
  return async function handler(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const action = args.trim().toLowerCase();

    if (action === "on") {
      ref.value = true;
      await saveGuardrailsSettings({ enabled: true });
      ctx.ui?.notify("Guardrails enabled", "info");
      return;
    }

    if (action === "off") {
      ref.value = false;
      await saveGuardrailsSettings({ enabled: false });
      ctx.ui?.notify("Guardrails disabled", "warning");
      return;
    }

    const status = ref.value ? "enabled" : "disabled";
    ctx.ui?.notify(
      `Guardrails are currently ${status}. Use /guardrails on|off.`,
      "info",
    );
  };
}

export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  const config = configLoader.getConfig();

  const guardrailsEnabledRef = {
    value: (await loadGuardrailsSettings()).enabled,
  };

  pi.registerCommand("guardrails", {
    description: "Enable or disable guardrails (usage: /guardrails on|off)",
    handler: createGuardrailsHandler(guardrailsEnabledRef),
  });

  setupPermissionGateHook(pi, config, () => guardrailsEnabledRef.value);
}

async function hasMatchingFiles(
  pattern: string,
  root: string,
): Promise<boolean> {
  const matches = await glob(pattern, {
    cwd: root,
    absolute: false,
    dot: true,
    onlyDirectories: false,
  });
  return matches.length > 0;
}

/**
 * Check if a guardrails group should be active based on file pattern matching.
 */
export async function isGroupActive(
  pattern: string,
  root: string,
  excludePattern?: string,
): Promise<boolean> {
  try {
    if (pattern === "*") return !excludePattern;
    if (!(await hasMatchingFiles(pattern, root))) return false;
    if (excludePattern) {
      const excludeMatches = await glob(excludePattern, {
        cwd: root,
        absolute: false,
        dot: true,
        onlyDirectories: false,
      });
      if (excludeMatches.length > 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getInputFieldAsString(
  input: unknown,
  field: string,
): string | undefined {
  if (!input || typeof input !== "object") return undefined;

  const value = (input as Record<string, unknown>)[field];
  if (value === undefined || value === null) return undefined;

  return String(value);
}

function matchesPattern(
  context: GuardrailsRule["context"],
  targetValue: string,
  pattern: string,
): boolean {
  if (context === "command") return matchCommandPattern(targetValue, pattern);

  return new RegExp(pattern).test(targetValue);
}

/**
 * Test whether a rule matches the current tool call.
 *
 * For "command" context, `pattern` uses AST-like token matching
 * implemented by `matchCommandPattern` (`?`, `*`).
 *
 * For "file_name" and "file_content" contexts, `pattern` is regex.
 *
 * @returns The matched target value for includes/excludes filtering, or null.
 */
function matchCommandRule(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
): { targetValue: string } | null {
  if (toolName !== "bash") return null;
  const command = getInputFieldAsString(input, "command");
  if (!command) return null;
  if (!matchCommandPattern(command, rule.pattern)) return null;
  return { targetValue: command };
}

function checkFilePatternMatch(
  filePath: string | undefined,
  filePattern: string | undefined,
): boolean {
  if (!filePattern || !filePath) return true;
  const filePatternRegex = new RegExp(filePattern);
  return filePatternRegex.test(filePath);
}

function isPathWithinProject(
  filePath: string | undefined,
  projectRoot: string,
): boolean {
  if (!filePath) return true;
  const absolutePath = filePath.startsWith("/")
    ? filePath
    : `${projectRoot}/${filePath}`;
  const normalizedPath = absolutePath.replace(/\/+/g, "/");
  const normalizedRoot = projectRoot.replace(/\/+/g, "/");
  return normalizedPath.startsWith(`${normalizedRoot}/`);
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

  if (rule.scope) {
    const withinProject = isPathWithinProject(filePath, cwd);
    if (rule.scope === "project" && !withinProject) return null;
    if (rule.scope === "external" && withinProject) return null;
  }

  const targetValue = getFileTargetValue(rule, toolName, input, filePath);
  if (!targetValue) return null;

  const rulePattern = new RegExp(rule.pattern);
  if (!rulePattern.test(targetValue)) return null;
  return { targetValue };
}

/**
 * Permission gate that prompts user confirmation for blocked operations.
 * Uses groups config to define blocking rules based on context.
 * Groups are only active if their file pattern matches files in the project.
 */
interface MatchedRule {
  rule: GuardrailsRule;
  group: GuardrailsGroup;
  targetValue: string;
}

async function shouldIncludeRule(
  rule: GuardrailsRule,
  targetValue: string,
): Promise<boolean> {
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
      if (!(await shouldIncludeRule(rule, targetValue))) continue;

      matched.push({ rule, group, targetValue });
    } catch {
      continue;
    }
  }

  return matched;
}

/**
 * Find matching rules for a tool call
 */
async function findMatchingRules(
  toolName: string,
  input: unknown,
  config: ResolvedConfig,
  cwd: string,
): Promise<MatchedRule[]> {
  const matched: MatchedRule[] = [];

  for (const group of config) {
    const groupMatches = await processGroupRules(group, toolName, input, cwd);
    matched.push(...groupMatches);
  }

  return matched;
}

/**
 * Handle a single matched rule
 */
async function handleMatchedRule(
  matched: MatchedRule,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> {
  const { rule, group, targetValue } = matched;
  const { action, reason } = rule;

  if (action === "block")
    return { block: true, reason: `Blocked [${group.group}]: ${reason}` };

  if (action === "confirm") {
    if (!ctx.hasUI)
      return { block: true, reason: `Blocked [${group.group}]: ${reason}` };

    const proceed = await ctx.ui.confirm(
      `⚠️ ${group.group}: ${reason}`,
      targetValue,
    );
    if (!proceed)
      return { block: true, reason: "Blocked: User denied execution" };
  }

  return undefined;
}

/**
 * Permission gate that prompts user confirmation for blocked operations.
 */
function setupPermissionGateHook(
  pi: ExtensionAPI,
  config: ResolvedConfig,
  isEnabled: () => boolean,
) {
  pi.on("tool_call", async (event, ctx) => {
    if (!isEnabled()) return;

    const toolName = event.toolName;
    const input = event.input;

    if (toolName === "read" || toolName === "genui") return;

    const matchedRules = await findMatchingRules(
      toolName,
      input,
      config,
      ctx.cwd,
    );

    for (const matched of matchedRules) {
      const result = await handleMatchedRule(matched, ctx);
      if (result) return result;
    }

    return;
  });
}
