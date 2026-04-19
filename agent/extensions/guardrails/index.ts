import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ThemeColor,
} from "@mariozechner/pi-coding-agent";
import { createThemeFg, notifyAuditResult } from "../../shared/audit-utils";
import {
  configLoader,
  loadGuardrailsSettings,
  saveGuardrailsSettings,
} from "./config";
import type { GuardrailsGroup, GuardrailsRule, ResolvedConfig } from "./config";
import {
  matchCommandPattern,
  matchContentPattern,
  matchFileNamePattern,
} from "../../shared/pattern-matching";
import { glob } from "tinyglobby";

function createGuardrailsHandler(
  ref: { value: boolean },
  _config: ResolvedConfig,
) {
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

    // No argument — run audit
    await handleGuardrailsAudit(args, ctx);
  };
}

export default async function (pi: ExtensionAPI) {
  configLoader.load();
  const config = configLoader.getConfig();

  const guardrailsEnabledRef = {
    value: (await loadGuardrailsSettings()).enabled,
  };

  pi.registerCommand("guardrails", {
    description:
      "Audit guardrails config, or toggle with on|off (usage: /guardrails [on|off])",
    handler: createGuardrailsHandler(guardrailsEnabledRef, config),
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

export async function isGroupActive(
  pattern: string,
  root: string,
  excludePattern?: string,
): Promise<boolean> {
  try {
    // Wildcard pattern is active by default; only deactivate if exclude matches
    if (pattern === "*") {
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
    }
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
  switch (context) {
    case "command":
      return matchCommandPattern(targetValue, pattern);
    case "file_name":
      return matchFileNamePattern(targetValue, pattern);
    case "file_content":
      return matchContentPattern(targetValue, pattern);
    default:
      return false;
  }
}

/**
 * Test whether a rule matches the current tool call.
 *
 * For "command" context, `pattern` uses AST-like token matching
 * implemented by `matchCommandPattern` (`?`, `*`).
 *
 * For "file_name" context, `pattern` uses glob matching via picomatch.
 * For "file_content" context, `pattern` uses literal substring matching
 * with pipe-separated alternatives.
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
  return matchFileNamePattern(filePath, filePattern);
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
  if (!passesScopeCheck(rule, filePath, cwd)) return null;

  const targetValue = getFileTargetValue(rule, toolName, input, filePath);
  if (!targetValue) return null;

  if (!matchesPattern(rule.context, targetValue, rule.pattern)) return null;
  return { targetValue };
}

function passesScopeCheck(
  rule: GuardrailsRule,
  filePath: string | undefined,
  cwd: string,
): boolean {
  if (!rule.scope) return true;
  const withinProject = isPathWithinProject(filePath, cwd);
  if (rule.scope === "project") return withinProject;
  return !withinProject;
}

interface MatchedRule {
  rule: GuardrailsRule;
  group: GuardrailsGroup;
  targetValue: string;
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
      if (!(await shouldIncludeRule(rule, targetValue))) continue;

      matched.push({ rule, group, targetValue });
    } catch {
      continue;
    }
  }

  return matched;
}

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

    const icon = ctx.ui.theme ? ctx.ui.theme.fg("warning", "󰀪") : "󰀪";
    const proceed = await ctx.ui.confirm(
      `${icon} ${group.group}: ${reason}`,
      targetValue,
    );
    if (!proceed)
      return { block: true, reason: "Blocked: User denied execution" };
  }

  return undefined;
}

async function handleGuardrailsAudit(
  _args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const config = configLoader.getConfig();

  if (config.length === 0) {
    ctx.ui?.notify("No guardrails configured", "info");
    return;
  }

  const fg = createThemeFg(ctx.ui.theme);
  const auditResult = await auditGuardrailsConfig(config, ctx.cwd, fg);
  notifyAuditResult(ctx, auditResult, fg);
}

interface GuardrailsAuditResult {
  lines: string[];
  errors: number;
}

async function auditGuardrailsConfig(
  config: ResolvedConfig,
  cwd: string,
  fg: (color: ThemeColor, text: string) => string,
): Promise<GuardrailsAuditResult> {
  const lines: string[] = [];
  let errors = 0;

  for (const group of config) {
    const isActive = await isGroupActive(
      group.pattern,
      cwd,
      group.excludePattern,
    );
    const statusIcon = isActive ? "✓" : "✗";
    const statusColor = isActive ? "success" : "error";
    lines.push(
      `${fg(statusColor, statusIcon)} ${group.group} (${group.pattern})`,
    );

    for (let i = 0; i < group.rules.length; i++) {
      const rule = group.rules[i];
      const actionTag =
        rule.action === "block" ? fg("error", "󰳛") : fg("warning", "󰀪");
      lines.push(`  ${actionTag} [${rule.context}] ${rule.pattern}`);

      errors += validateGuardrailsRule(rule, i, fg, lines);
    }
  }

  return { lines, errors };
}

function validateGuardrailsRule(
  rule: GuardrailsRule,
  index: number,
  fg: (color: ThemeColor, text: string) => string,
  lines: string[],
): number {
  let errors = 0;

  if (
    (rule.context === "file_name" || rule.context === "file_content") &&
    rule.pattern
  ) {
    try {
      matchesPattern(rule.context, "test", rule.pattern);
    } catch (e) {
      lines.push(
        `    ${fg("error", "✗")} invalid pattern at rules[${index}]: ${(e as Error).message}`,
      );
      errors++;
    }

    if (rule.file_pattern) {
      try {
        matchFileNamePattern("test", rule.file_pattern);
      } catch (e) {
        lines.push(
          `    ${fg("error", "✗")} invalid file_pattern at rules[${index}]: ${(e as Error).message}`,
        );
        errors++;
      }
    }
  }

  if (rule.context === "command") {
    try {
      matchCommandPattern("echo test", rule.pattern);
    } catch (e) {
      lines.push(
        `    ${fg("error", "✗")} invalid command pattern at rules[${index}]: ${(e as Error).message}`,
      );
      errors++;
    }
  }

  return errors;
}

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
