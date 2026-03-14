import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  configLoader,
  loadGuardrailsSettings,
  saveGuardrailsSettings,
} from "./config";
import type { GuardrailsRule, ResolvedConfig } from "./config";
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

export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  const config = configLoader.getConfig();

  let guardrailsEnabled = (await loadGuardrailsSettings()).enabled;

  pi.registerCommand("guardrails", {
    description: "Enable or disable guardrails (usage: /guardrails on|off)",
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();

      if (action === "on") {
        guardrailsEnabled = true;
        await saveGuardrailsSettings({ enabled: true });
        if (ctx.hasUI) {
          ctx.ui.notify("Guardrails enabled", "info");
        }
        return;
      }

      if (action === "off") {
        guardrailsEnabled = false;
        await saveGuardrailsSettings({ enabled: false });
        if (ctx.hasUI) {
          ctx.ui.notify("Guardrails disabled", "warning");
        }
        return;
      }

      const status = guardrailsEnabled ? "enabled" : "disabled";
      if (ctx.hasUI) {
        ctx.ui.notify(
          `Guardrails are currently ${status}. Use /guardrails on|off.`,
          "info",
        );
      }
    },
  });

  setupPermissionGateHook(pi, config, () => guardrailsEnabled);
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
    if (pattern === "*") {
      if (!excludePattern) return true;
    } else {
      const matches = await glob(pattern, {
        cwd: root,
        absolute: false,
        dot: true,
        onlyDirectories: false,
      });
      if (matches.length === 0) return false;
    }

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
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const value = (input as Record<string, unknown>)[field];
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

function matchesPattern(
  context: GuardrailsRule["context"],
  targetValue: string,
  pattern: string,
): boolean {
  if (context === "command") {
    return matchCommandPattern(targetValue, pattern);
  }

  return new RegExp(pattern).test(targetValue);
}

/**
 * Test whether a rule matches the current tool call.
 *
 * For "command" context, `pattern` uses AST-like token matching
 * implemented by `matchCommandPattern` (`?`, `*`).
 *
 * For "file_name" and "file_content" contexts, `pattern` is regex.
 * If `file_pattern` is specified, the file path must match it first.
 *
 * @returns The matched target value for includes/excludes filtering, or null.
 */
function matchRule(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
): { targetValue: string } | null {
  if (rule.context === "command") {
    if (toolName !== "bash") return null;
    const command = getInputFieldAsString(input, "command");
    if (!command) return null;

    if (!matchCommandPattern(command, rule.pattern)) return null;
    return { targetValue: command };
  }

  // For file_name and file_content contexts, check file_pattern first
  const filePath = getInputFieldAsString(input, "path");
  if (rule.file_pattern && filePath) {
    const filePatternRegex = new RegExp(rule.file_pattern);
    if (!filePatternRegex.test(filePath)) return null;
  }

  let targetValue: string | undefined;

  if (rule.context === "file_name") {
    if (["edit", "write"].includes(toolName)) {
      targetValue = filePath;
    }
  } else if (rule.context === "file_content") {
    if (toolName === "edit") {
      targetValue = getInputFieldAsString(input, "newText");
    } else if (toolName === "write") {
      targetValue = getInputFieldAsString(input, "content");
    }
  }

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
function setupPermissionGateHook(
  pi: ExtensionAPI,
  config: ResolvedConfig,
  isEnabled: () => boolean,
) {
  const inspectedRoots = new Set<string>();

  pi.on("tool_call", async (event, ctx) => {
    if (!isEnabled()) {
      return;
    }
    const toolName = event.toolName;
    const input = event.input;

    if (!inspectedRoots.has(ctx.cwd)) {
      if (toolName === "bash") {
        const command = getInputFieldAsString(input, "command");
        if (command && matchCommandPattern(command, "tree *")) {
          inspectedRoots.add(ctx.cwd);
          return;
        }
      }

      return {
        block: true,
        reason:
          "Blocked: Run `tree -a -L 3 -I 'node_modules|dist|build|coverage|.git|.jj|.turbo|.next|.cache|tmp|.direnv' .` first to inspect project structure before calling other tools.",
      };
    }

    // Skip tools that don't modify the project
    if (toolName === "read" || toolName === "genui") return;

    for (const group of config) {
      const isActive = await isGroupActive(group.pattern, ctx.cwd, group.excludePattern);
      if (!isActive) {
        continue;
      }

      for (const rule of group.rules) {
        try {
          const matched = matchRule(rule, toolName, input);
          if (!matched) continue;

          const { targetValue } = matched;

          // Check includes: if specified, must also match
          if (
            rule.includes &&
            !matchesPattern(rule.context, targetValue, rule.includes)
          ) {
            continue;
          }

          // Check excludes: if specified and matches, skip this rule
          if (
            rule.excludes &&
            matchesPattern(rule.context, targetValue, rule.excludes)
          ) {
            continue;
          }

          const { action, reason } = rule;

          if (action === "block") {
            return { block: true, reason: `Blocked [${group.group}]: ${reason}` };
          } else if (action === "confirm") {
            if (!ctx.hasUI) {
              return {
                block: true,
                reason: `Blocked [${group.group}]: ${reason}`,
              };
            }

            const proceed = await ctx.ui.confirm(
              `⚠️ ${group.group}: ${reason}`,
              targetValue,
            );

            if (!proceed) {
              return {
                block: true,
                reason: "Blocked: User denied execution",
              };
            }
          }
        } catch {
          continue;
        }
      }
    }
    return;
  });
}
