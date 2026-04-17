import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
  TurnEndEvent,
} from "@mariozechner/pi-coding-agent";

import { configLoader } from "./config";
import type { HookEvent, HooksConfig } from "./schema";
import { processHooks as _processHooks } from "./engine.js";
import { getSkipTools } from "./results.js";
import {
  isAbortedToolResult,
  isAbortedTurnEnd,
  isAbortedAgentEnd,
} from "./abort-detection.js";
import { isGroupActive } from "./pattern-matching.js";

/**
 * Hooks Extension
 *
 * Run shell commands at specific points in pi's lifecycle.
 * Inspired by Claude Code hooks: https://code.claude.com/docs/en/hooks
 *
 * Features:
 * - JSON input via stdin (Claude Code compatible)
 * - JSON output for decision control (allow/deny/block)
 * - Exit code 2 for blocking tool calls
 * - Variable substitution (%file%, %tool%, %cwd%)
 * - Group-based activation via file patterns
 *
 * Supported events:
 * - session_start, session_shutdown
 * - tool_call (PreToolUse), tool_result (PostToolUse)
 * - agent_start, agent_end (Stop)
 * - turn_start, turn_end
 */

export default async function hooksExtension(pi: ExtensionAPI): Promise<void> {
  await configLoader.load();
  let currentVersion = configLoader.getVersion();

  const getConfig = async (cwd: string): Promise<HooksConfig> => {
    const newVersion = configLoader.getVersion();
    if (newVersion !== currentVersion) currentVersion = newVersion;
    return configLoader.getConfigForProject(cwd);
  };

  registerEventHandlers(pi, getConfig);
  registerCommands(pi);
}

interface BlockResult {
  block: true;
  reason: string;
}

async function processHooks(
  pi: ExtensionAPI,
  config: HooksConfig,
  event: HookEvent,
  ctx: ExtensionContext,
  toolName?: string,
  input?: unknown,
  toolCallId?: string,
  toolResponse?: { content?: unknown[]; details?: unknown; isError?: boolean },
): Promise<BlockResult | undefined> {
  return _processHooks(pi, config, {
    event,
    ctx,
    toolInfo: { toolName, input, toolCallId, toolResponse },
  });
}

function registerEventHandlers(
  pi: ExtensionAPI,
  getConfig: (cwd: string) => Promise<HooksConfig>,
): void {
  let abortedInCurrentTurn = false;

  pi.on("session_start", async (_event, ctx) => {
    await processHooks(pi, await getConfig(ctx.cwd), "session_start", ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (abortedInCurrentTurn) return;
    await processHooks(pi, await getConfig(ctx.cwd), "session_shutdown", ctx);
  });

  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    if (getSkipTools().has(event.toolName)) return;
    return processHooks(
      pi,
      await getConfig(ctx.cwd),
      "tool_call",
      ctx,
      event.toolName,
      event.input,
      event.toolCallId,
    );
  });

  pi.on("tool_result", async (event: ToolResultEvent, ctx) => {
    if (getSkipTools().has(event.toolName)) return;

    if (isAbortedToolResult(event)) {
      abortedInCurrentTurn = true;
      return;
    }

    await processHooks(
      pi,
      await getConfig(ctx.cwd),
      "tool_result",
      ctx,
      event.toolName,
      event.input,
      event.toolCallId,
      {
        content: event.content,
        details: event.details,
        isError: event.isError,
      },
    );
  });

  pi.on("agent_start", async (_event, ctx) => {
    await processHooks(pi, await getConfig(ctx.cwd), "agent_start", ctx);
  });

  (
    pi as ExtensionAPI & {
      on(
        event: "agent_end",
        handler: (event: AgentEndEvent, ctx: ExtensionContext) => Promise<void>,
      ): void;
    }
  ).on("agent_end", async (event: AgentEndEvent, ctx: ExtensionContext) => {
    if (abortedInCurrentTurn || isAbortedAgentEnd(event)) return;
    await processHooks(pi, await getConfig(ctx.cwd), "agent_end", ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    abortedInCurrentTurn = false;
    await processHooks(pi, await getConfig(ctx.cwd), "turn_start", ctx);
  });

  pi.on("turn_end", async (event: TurnEndEvent, ctx) => {
    if (abortedInCurrentTurn || isAbortedTurnEnd(event)) return;
    await processHooks(pi, await getConfig(ctx.cwd), "turn_end", ctx);
  });
}

async function handleHooksReload(
  _args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  try {
    await configLoader.load();
    const config = configLoader.getConfig();
    ctx.ui?.notify(`Hooks reloaded: ${config.length} groups loaded`, "info");
  } catch (error) {
    ctx.ui?.notify(`Failed to reload hooks: ${error}`, "error");
  }
}

async function handleHooksList(
  _args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (!ctx.hasUI) return;
  const config = configLoader.getConfig();

  if (config.length === 0) {
    ctx.ui?.notify("No hooks configured", "info");
    return;
  }

  const lines: string[] = [];
  for (const group of config) {
    const isActive = await isGroupActive(group.pattern, ctx.cwd);
    const status = isActive ? "✓" : "✗";
    lines.push(`${status} ${group.group} (${group.pattern})`);
    for (const hook of group.hooks) {
      const context = hook.context ? ` [${hook.context}: ${hook.pattern}]` : "";
      lines.push(`  → ${hook.event}${context}: ${hook.command}`);
    }
  }

  ctx.ui?.notify(lines.join("\n"), "info");
}

function registerCommands(pi: ExtensionAPI): void {
  pi.registerCommand("hooks-reload", {
    description: "Reload hooks configuration from disk",
    handler: handleHooksReload,
  });

  pi.registerCommand("hooks-list", {
    description: "List all configured hooks with their active status",
    handler: handleHooksList,
  });
}
