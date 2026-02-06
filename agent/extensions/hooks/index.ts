import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import pc from "picocolors";
import { glob } from "tinyglobby";
import { configLoader } from "./config";
import type { HookEvent, HookRule, HooksConfig, HooksGroup } from "./schema";

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
 */

const SKIP_TOOLS = new Set(["read"]);

interface HookVariables {
  file?: string;
  tool?: string;
  cwd: string;
}

interface HookResult {
  success: boolean;
  output: string;
  group: string;
  command: string;
}

interface BlockResult {
  block: true;
  reason: string;
}

export default async function hooksExtension(pi: ExtensionAPI): Promise<void> {
  await configLoader.load();
  let currentVersion = configLoader.getVersion();

  const getConfig = (): HooksConfig => {
    const newVersion = configLoader.getVersion();
    if (newVersion !== currentVersion) {
      currentVersion = newVersion;
    }
    return configLoader.getConfig();
  };

  registerEventHandlers(pi, getConfig);
  registerCommands(pi);
}

export async function isGroupActive(
  pattern: string,
  root: string,
): Promise<boolean> {
  if (pattern === "*") return true;

  try {
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

export function substituteVariables(
  command: string,
  vars: HookVariables,
): string {
  return command
    .replace(/\$\{file\}/g, vars.file ?? "")
    .replace(/\$\{tool\}/g, vars.tool ?? "")
    .replace(/\$\{cwd\}/g, vars.cwd);
}

export function doesRuleMatch(
  rule: HookRule,
  toolName?: string,
  input?: unknown,
): boolean {
  if (!rule.context || !rule.pattern) return true;

  const targetValue = getContextValue(rule.context, toolName, input);
  if (targetValue === undefined) return false;

  try {
    return new RegExp(rule.pattern).test(targetValue);
  } catch {
    return false;
  }
}

function getContextValue(
  context: string,
  toolName?: string,
  input?: unknown,
): string | undefined {
  switch (context) {
    case "tool_name":
      return toolName;
    case "file_name":
      return getInputField(input, "path");
    case "command":
      return toolName === "bash" ? getInputField(input, "command") : undefined;
    default:
      return undefined;
  }
}

function getInputField(input: unknown, field: string): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return value != null ? String(value) : undefined;
}

async function runHook(
  pi: ExtensionAPI,
  rule: HookRule,
  group: HooksGroup,
  ctx: ExtensionContext,
  vars: HookVariables,
): Promise<HookResult> {
  const command = substituteVariables(rule.command, vars);

  if (command.includes("${")) {
    return { success: true, output: "", group: group.group, command };
  }

  const timeout = rule.timeout ?? 30000;
  const cwd = rule.cwd ?? ctx.cwd;

  try {
    const result = await pi.exec("sh", ["-c", `set -o pipefail; ${command}`], {
      timeout,
      cwd,
    });

    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();

    return {
      success: result.code === 0,
      output,
      group: group.group,
      command,
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
      group: group.group,
      command,
    };
  }
}

async function processHooks(
  pi: ExtensionAPI,
  config: HooksConfig,
  event: HookEvent,
  ctx: ExtensionContext,
  toolName?: string,
  input?: unknown,
): Promise<BlockResult | undefined> {
  const filePath = getInputField(input, "path");
  const vars: HookVariables = { file: filePath, tool: toolName, cwd: ctx.cwd };

  const results: HookResult[] = [];

  for (const group of config) {
    if (!(await isGroupActive(group.pattern, ctx.cwd))) continue;

    for (const rule of group.hooks) {
      if (rule.event !== event) continue;
      if (!doesRuleMatch(rule, toolName, input)) continue;

      const result = await runHook(pi, rule, group, ctx, vars);

      if (!result.success && event === "tool_call") {
        const reason = result.output
          ? `Hook failed: ${result.group}: ${result.command}\n${result.output}`
          : `Hook failed: ${result.group}: ${result.command}`;
        return { block: true, reason };
      }

      if (rule.notify !== false) {
        results.push(result);
      }
    }
  }

  if (results.length > 0) {
    sendHookResults(pi, results);
  }

  return undefined;
}

function sendHookResults(pi: ExtensionAPI, results: HookResult[]): void {
  const grouped = new Map<string, HookResult[]>();
  for (const r of results) {
    const list = grouped.get(r.group) ?? [];
    list.push(r);
    grouped.set(r.group, list);
  }

  const lines: string[] = [];
  for (const [group, hooks] of grouped) {
    lines.push(pc.bold(pc.cyan(`[${group}]`)));
    for (const r of hooks) {
      const icon = r.success ? pc.green("✅") : pc.red("❌");
      const cmd = r.success ? pc.dim(r.command) : pc.yellow(r.command);
      lines.push(`    ${icon} ${cmd}`);
      if (r.output) {
        lines.push(r.success ? pc.dim(r.output) : pc.red(r.output));
      }
    }
  }

  pi.sendMessage(
    { customType: "hook", content: lines.join("\n"), display: true },
    { triggerTurn: false },
  );
}

function registerEventHandlers(
  pi: ExtensionAPI,
  getConfig: () => HooksConfig,
): void {
  pi.on("session_start", async (_event, ctx) => {
    await processHooks(pi, getConfig(), "session_start", ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await processHooks(pi, getConfig(), "session_shutdown", ctx);
  });

  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    if (SKIP_TOOLS.has(event.toolName)) return;
    return processHooks(
      pi,
      getConfig(),
      "tool_call",
      ctx,
      event.toolName,
      event.input,
    );
  });

  pi.on("tool_result", async (event: ToolResultEvent, ctx) => {
    if (SKIP_TOOLS.has(event.toolName)) return;
    await processHooks(
      pi,
      getConfig(),
      "tool_result",
      ctx,
      event.toolName,
      event.input,
    );
  });

  pi.on("agent_start", async (_event, ctx) => {
    await processHooks(pi, getConfig(), "agent_start", ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    await processHooks(pi, getConfig(), "agent_end", ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    await processHooks(pi, getConfig(), "turn_start", ctx);
  });

  pi.on("turn_end", async (_event, ctx) => {
    await processHooks(pi, getConfig(), "turn_end", ctx);
  });
}

function registerCommands(pi: ExtensionAPI): void {
  pi.registerCommand("hooks-reload", {
    description: "Reload hooks configuration from disk",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
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
    description: "List all configured hooks with their active status",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
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
