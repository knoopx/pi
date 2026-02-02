import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { configLoader } from "./config";
import type { ResolvedConfig, GuardrailsGroup } from "./config";
import { GroupEditor } from "./ui/group-editor";
import { createConfirmationDialog } from "./ui/confirmation-dialog";
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
 * - Command: /guardrails
 */

export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  const config = configLoader.getConfig();

  setupPermissionGateHook(pi, config);
  registerSettingsCommand(pi);
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
              if (["read", "edit", "write"].includes(toolName)) {
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
            const { action, reason } = rule;

            if (action === "block") {
              ctx.ui.notify(`Blocked: ${reason}`, "error");

              return { block: true, reason };
            } else if (action === "confirm") {
              const proceed = await ctx.ui.custom<boolean>(
                (_tui, theme, _kb, done) =>
                  createConfirmationDialog(
                    {
                      title: "Dangerous Operation Detected",
                      message: `This operation was blocked:`,
                      content: targetValue!,
                      confirmText: "y/enter: allow",
                      cancelText: "n/esc: deny",
                      danger: true,
                    },
                    theme,
                    done,
                  ),
              );

              if (!proceed) {
                return {
                  block: true,
                  reason: "User denied dangerous operation",
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

export function registerSettingsCommand(pi: ExtensionAPI): void {
  pi.registerCommand("guardrails", {
    description: "Configure guardrails groups",
    handler: async (_args, ctx) => {
      const currentConfig = configLoader.getGlobalConfig();

      await ctx.ui.custom((_tui, theme, _kb, done) => {
        const groupEditor = new GroupEditor({
          label: "Guardrails Groups",
          items: [...currentConfig],
          theme,
          onSave: async (groups: GuardrailsGroup[]) => {
            try {
              await configLoader.saveGlobal(groups);
              ctx.ui.notify("Guardrails saved", "info");
              done(undefined);
            } catch (error) {
              ctx.ui.notify(`Failed to save: ${error}`, "error");
            }
          },
          onDone: () => done(undefined),
        });

        return {
          render: (width: number) => groupEditor.render(width),
          invalidate: () => groupEditor.invalidate(),
          handleInput: (data: string) => groupEditor.handleInput(data),
        };
      });
    },
  });
}
