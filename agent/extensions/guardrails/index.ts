import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { configLoader } from "./config";
import type { ResolvedConfig } from "./config";
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

  setupPermissionGateHook(pi, config);
}

/**
 * Check if a guardrails group should be active based on file pattern matching.
 */
export async function isGroupActive(
  pattern: string,
  root: string,
): Promise<boolean> {
  try {
    if (pattern === "*") {
      return true;
    }

    const matches = await glob([pattern], {
      cwd: root,
      absolute: false,
      dot: true,
      onlyDirectories: false,
    });

    return matches.length > 0;
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

/**
 * Permission gate that prompts user confirmation for blocked operations.
 * Uses groups config to define blocking rules based on context.
 * Groups are only active if their file pattern matches files in the project.
 */
function setupPermissionGateHook(pi: ExtensionAPI, config: ResolvedConfig) {
  pi.on("tool_call", async (event, ctx) => {
    // Skip "read" tool to avoid noise on every file read
    if (event.toolName === "read") return;

    const toolName = event.toolName;
    const input = event.input;

    for (const group of config) {
      const isActive = await isGroupActive(group.pattern, ctx.cwd);
      if (!isActive) {
        continue;
      }

      for (const rule of group.rules) {
        try {
          const rulePattern = new RegExp(rule.pattern);
          let targetValue: string | undefined;

          // Determine what to check based on context
          switch (rule.context) {
            case "command":
              if (toolName === "bash") {
                targetValue = getInputFieldAsString(input, "command");
              }
              break;
            case "file_name":
              if (["edit", "write"].includes(toolName)) {
                targetValue = getInputFieldAsString(input, "path");
              }
              break;
            case "file_content":
              if (toolName === "edit") {
                targetValue = getInputFieldAsString(input, "newText");
              } else if (toolName === "write") {
                targetValue = getInputFieldAsString(input, "content");
              }
              break;
          }

          if (targetValue && rulePattern.test(targetValue)) {
            // Check includes: if specified, must also match
            if (rule.includes) {
              const includesPattern = new RegExp(rule.includes);
              if (!includesPattern.test(targetValue)) {
                continue;
              }
            }

            // Check excludes: if specified and matches, skip this rule
            if (rule.excludes) {
              const excludesPattern = new RegExp(rule.excludes);
              if (excludesPattern.test(targetValue)) {
                continue;
              }
            }

            const { action, reason } = rule;

            if (action === "block") {
              if (ctx.hasUI) {
                ctx.ui.notify(`Blocked: ${reason}`, "error");
              }
              return { block: true, reason: `Blocked: ${reason}` };
            } else if (action === "confirm") {
              // In non-interactive mode, block by default (can't confirm without UI)
              if (!ctx.hasUI) {
                return {
                  block: true,
                  reason: `Blocked: ${reason} (no UI for confirmation)`,
                };
              }

              const proceed = await ctx.ui.confirm(
                "Dangerous Operation Detected",
                `${reason}\n\n${targetValue}`,
              );

              if (!proceed) {
                return {
                  block: true,
                  reason: "Blocked: User denied dangerous operation",
                };
              }
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
