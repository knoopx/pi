import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import { glob } from "tinyglobby";
import {
  configLoader,
  type HookEvent,
  type HookRule,
  type ResolvedConfig,
} from "./config";

/**
 * Hooks Extension
 *
 * Run shell commands after pi events based on patterns.
 * Groups define file patterns and hook rules for running commands.
 * A group is activated if any file matching its pattern exists in the project.
 *
 * Configuration:
 * - Extension defaults: defaults.json (used when no global config exists)
 * - Global settings: ~/.pi/agent/settings.json under key "hooks"
 *
 * Supported events:
 * - session_start, session_shutdown
 * - tool_call, tool_result
 * - agent_start, agent_end
 * - turn_start, turn_end
 *
 * For tool_call/tool_result events, you can specify a context:
 * - tool_name: Match against the tool name
 * - file_name: Match against file paths in tool input
 * - command: Match against bash commands
 */

export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  const config = configLoader.getConfig();

  setupHooks(pi, config);
  registerReloadCommand(pi);
}

/**
 * Check if a hooks group should be active based on file pattern matching.
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

/**
 * Extract a string field from an unknown input object.
 */
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
 * Variables available for substitution in hook commands.
 */
interface HookVariables {
  file?: string;
  tool?: string;
  cwd: string;
}

/**
 * Substitute variables in a command string.
 * Supports: ${file}, ${tool}, ${cwd}
 */
export function substituteVariables(
  command: string,
  vars: HookVariables,
): string {
  return command
    .replace(/\$\{file\}/g, vars.file ?? "")
    .replace(/\$\{tool\}/g, vars.tool ?? "")
    .replace(/\$\{cwd\}/g, vars.cwd);
}

/**
 * Check if a hook rule matches the current context.
 */
function doesRuleMatch(
  rule: HookRule,
  toolName?: string,
  input?: unknown,
): boolean {
  // If no context/pattern specified, always match
  if (!rule.context || !rule.pattern) {
    return true;
  }

  try {
    const rulePattern = new RegExp(rule.pattern);
    let targetValue: string | undefined;

    switch (rule.context) {
      case "tool_name":
        targetValue = toolName;
        break;
      case "file_name":
        if (toolName && ["read", "edit", "write", "bash"].includes(toolName)) {
          targetValue = getInputFieldAsString(input, "path");
        }
        break;
      case "command":
        if (toolName === "bash") {
          targetValue = getInputFieldAsString(input, "command");
        }
        break;
    }

    return targetValue !== undefined && rulePattern.test(targetValue);
  } catch {
    return false;
  }
}

/**
 * Run a hook command and return the result.
 */
async function runHookCommand(
  pi: ExtensionAPI,
  rule: HookRule,
  ctx: ExtensionContext,
  vars: HookVariables,
): Promise<{ success: boolean; output: string }> {
  const timeout = rule.timeout ?? 30000;
  const cwd = rule.cwd ?? ctx.cwd;
  const command = substituteVariables(rule.command, vars);

  // Skip if command contains unsubstituted variables (e.g., ${file} when no file)
  if (command.includes("${")) {
    return { success: true, output: "" };
  }

  try {
    const result = await pi.exec("sh", ["-c", command], {
      timeout,
      cwd,
    });

    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    const success = result.code === 0;

    return { success, output };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, output: errorMessage };
  }
}

/**
 * Process hooks for a given event.
 */
async function processHooks(
  pi: ExtensionAPI,
  config: ResolvedConfig,
  event: HookEvent,
  ctx: ExtensionContext,
  toolName?: string,
  input?: unknown,
): Promise<void> {
  // Extract file path from tool input if available
  const filePath = getInputFieldAsString(input, "path");

  // Build variables for substitution
  const vars: HookVariables = {
    file: filePath,
    tool: toolName,
    cwd: ctx.cwd,
  };

  for (const group of config) {
    const isActive = await isGroupActive(group.pattern, ctx.cwd);
    if (!isActive) {
      continue;
    }

    for (const rule of group.hooks) {
      if (rule.event !== event) {
        continue;
      }

      if (!doesRuleMatch(rule, toolName, input)) {
        continue;
      }

      const { success, output } = await runHookCommand(pi, rule, ctx, vars);
      const shouldNotify = rule.notify !== false;

      // Skip notification for skipped commands (empty output and success)
      if (success && !output) {
        continue;
      }

      if (shouldNotify && ctx.hasUI) {
        if (success) {
          ctx.ui.notify(`✓ ${group.group}: ${rule.command}`, "info");
        } else {
          ctx.ui.notify(
            `✗ ${group.group}: ${rule.command}\n${output}`,
            "error",
          );
        }
      }
    }
  }
}

/**
 * Setup all event hooks.
 */
function setupHooks(pi: ExtensionAPI, config: ResolvedConfig): void {
  // Session events
  pi.on("session_start", async (_event, ctx) => {
    await processHooks(pi, config, "session_start", ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await processHooks(pi, config, "session_shutdown", ctx);
  });

  // Tool events (skip "read" tool to avoid noise on every file read)
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    if (event.toolName === "read") return;
    await processHooks(
      pi,
      config,
      "tool_call",
      ctx,
      event.toolName,
      event.input,
    );
  });

  pi.on("tool_result", async (event: ToolResultEvent, ctx) => {
    if (event.toolName === "read") return;
    await processHooks(
      pi,
      config,
      "tool_result",
      ctx,
      event.toolName,
      event.input,
    );
  });

  // Agent events
  pi.on("agent_start", async (_event, ctx) => {
    await processHooks(pi, config, "agent_start", ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    await processHooks(pi, config, "agent_end", ctx);
  });

  // Turn events
  pi.on("turn_start", async (_event, ctx) => {
    await processHooks(pi, config, "turn_start", ctx);
  });

  pi.on("turn_end", async (_event, ctx) => {
    await processHooks(pi, config, "turn_end", ctx);
  });
}

/**
 * Register the /hooks-reload command to reload configuration.
 */
function registerReloadCommand(pi: ExtensionAPI): void {
  pi.registerCommand("hooks-reload", {
    description: "Reload hooks configuration from disk",
    handler: async (_args, ctx) => {
      try {
        await configLoader.load();
        const config = configLoader.getConfig();
        ctx.ui.notify(`Hooks reloaded: ${config.length} groups loaded`, "info");
      } catch (error) {
        ctx.ui.notify(`Failed to reload hooks: ${error}`, "error");
      }
    },
  });

  pi.registerCommand("hooks-list", {
    description: "List all configured hooks",
    handler: async (_args, ctx) => {
      const config = configLoader.getConfig();

      if (config.length === 0) {
        ctx.ui.notify("No hooks configured", "info");
        return;
      }

      const lines: string[] = [];
      for (const group of config) {
        const isActive = await isGroupActive(group.pattern, ctx.cwd);
        const status = isActive ? "✓" : "✗";
        lines.push(`${status} ${group.group} (${group.pattern})`);
        for (const hook of group.hooks) {
          const context = hook.context
            ? ` [${hook.context}: ${hook.pattern}]`
            : "";
          lines.push(`  → ${hook.event}${context}: ${hook.command}`);
        }
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
