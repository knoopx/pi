import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
  TurnEndEvent,
} from "@mariozechner/pi-coding-agent";
import pc from "picocolors";
import { glob } from "tinyglobby";
import { configLoader } from "./config";
import type {
  HookEvent,
  HookInput,
  HookOutput,
  HookRule,
  HooksConfig,
  HooksGroup,
} from "./schema";
import { parseHookOutput } from "./schema";

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
 * - Variable substitution (${file}, ${tool}, ${cwd})
 * - Group-based activation via file patterns
 *
 * Supported events:
 * - session_start, session_shutdown
 * - tool_call (PreToolUse), tool_result (PostToolUse)
 * - agent_start, agent_end (Stop)
 * - turn_start, turn_end
 */

const SKIP_TOOLS = new Set(["read"]);
const NON_BLOCKING_TOOLS = new Set(["edit", "write"]);

interface HookVariables {
  file?: string;
  tool?: string;
  cwd: string;
}

interface HookResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  output: HookOutput | undefined;
  group: string;
  command: string;
}

interface BlockResult {
  block: true;
  reason: string;
}

function containsAbortText(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("operation aborted") ||
    normalized.includes("aborted") ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled")
  );
}

function extractTextContent(
  content: Array<unknown> | undefined,
  extraText?: string,
): string {
  const contentText = (content ?? [])
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        const value = (item as { text?: unknown }).text;
        return typeof value === "string" ? value : "";
      }
      return "";
    })
    .join("\n");

  return [contentText, extraText ?? ""].filter(Boolean).join("\n");
}

function isAbortedToolResult(event: ToolResultEvent): boolean {
  if (!event.isError) return false;
  return containsAbortText(extractTextContent(event.content));
}

function isAbortedTurnEnd(event: TurnEndEvent): boolean {
  const message = (event as { message?: unknown }).message as
    | {
        role?: string;
        stopReason?: string;
        errorMessage?: string;
      }
    | undefined;

  if (!message) return false;
  if (message.role === "assistant" && message.stopReason === "aborted") {
    return true;
  }

  return containsAbortText(message.errorMessage ?? "");
}

function isAbortedAgentEnd(event: AgentEndEvent): boolean {
  const messages = (event as { messages?: unknown[] }).messages ?? [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as {
      role?: string;
      stopReason?: string;
      errorMessage?: string;
    };

    if (message.role !== "assistant") continue;
    if (message.stopReason === "aborted") return true;
    if (containsAbortText(message.errorMessage ?? "")) return true;
    return false;
  }

  return false;
}

export default async function hooksExtension(pi: ExtensionAPI): Promise<void> {
  await configLoader.load();
  let currentVersion = configLoader.getVersion();

  const getConfig = async (cwd: string): Promise<HooksConfig> => {
    const newVersion = configLoader.getVersion();
    if (newVersion !== currentVersion) {
      currentVersion = newVersion;
    }
    return configLoader.getConfigForProject(cwd);
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

/**
 * Build JSON input for hook stdin (Claude Code compatible format).
 */
function buildHookInput(
  event: HookEvent,
  ctx: ExtensionContext,
  toolName?: string,
  input?: unknown,
  toolCallId?: string,
  toolResponse?: { content?: unknown[]; details?: unknown; isError?: boolean },
): HookInput {
  const hookInput: HookInput = {
    cwd: ctx.cwd,
    hook_event_name: event,
  };

  if (toolName) {
    hookInput.tool_name = toolName;
  }

  if (input && typeof input === "object") {
    hookInput.tool_input = input as Record<string, unknown>;
  }

  if (toolCallId) {
    hookInput.tool_call_id = toolCallId;
  }

  if (toolResponse) {
    hookInput.tool_response = {
      content: toolResponse.content,
      details: toolResponse.details as Record<string, unknown> | undefined,
      isError: toolResponse.isError,
    };
  }

  return hookInput;
}

async function runHook(
  pi: ExtensionAPI,
  rule: HookRule,
  group: HooksGroup,
  ctx: ExtensionContext,
  vars: HookVariables,
  hookInput: HookInput,
): Promise<HookResult> {
  const command = substituteVariables(rule.command, vars);

  // Skip if variables weren't substituted
  if (command.includes("${")) {
    return {
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      output: undefined,
      group: group.group,
      command,
    };
  }

  const timeout = rule.timeout ?? 30000;
  const cwd = rule.cwd ?? ctx.cwd;

  // Prepare JSON input for stdin
  const stdinInput = JSON.stringify(hookInput);

  try {
    // Run hook with JSON input via stdin
    const result = await pi.exec(
      "sh",
      [
        "-c",
        `set -o pipefail; echo '${stdinInput.replace(/'/g, "'\\''")}' | ${command}`,
      ],
      { timeout, cwd },
    );

    const stdout = result.stdout?.trim() ?? "";
    const stderr = result.stderr?.trim() ?? "";

    // Parse JSON output if exit code is 0
    const output = result.code === 0 ? parseHookOutput(stdout) : undefined;

    return {
      success: result.code === 0,
      exitCode: result.code ?? 1,
      stdout,
      stderr,
      output,
      group: group.group,
      command,
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      output: undefined,
      group: group.group,
      command,
    };
  }
}

/**
 * Determine if a hook result should block the action.
 *
 * Blocking conditions:
 * 1. Exit code 2 (explicit block)
 * 2. JSON output with decision: "block"
 * 3. JSON output with hookSpecificOutput.permissionDecision: "deny"
 */
function shouldBlock(
  result: HookResult,
  event: HookEvent,
  toolName?: string,
): { block: boolean; reason: string } {
  // Exit code 2 = blocking error (Claude Code convention)
  if (result.exitCode === 2) {
    const reason =
      result.stderr || `Hook blocked: ${result.group}: ${result.command}`;
    return { block: true, reason };
  }

  // Check JSON output for blocking decision
  if (result.output) {
    const { output } = result;

    // continue: false stops everything
    if (output.continue === false) {
      return {
        block: true,
        reason: output.stopReason || "Hook stopped processing",
      };
    }

    // decision: "block" for tool_call, tool_result, agent_end
    if (output.decision === "block" && output.reason) {
      return { block: true, reason: output.reason };
    }

    // hookSpecificOutput.permissionDecision: "deny" for tool_call (PreToolUse)
    if (event === "tool_call" && output.hookSpecificOutput) {
      const { permissionDecision, permissionDecisionReason } =
        output.hookSpecificOutput;
      if (permissionDecision === "deny") {
        return {
          block: true,
          reason: permissionDecisionReason || "Hook denied permission",
        };
      }
    }
  }

  // Non-zero exit codes (other than 2) are non-blocking errors
  // unless it's a tool_call/agent_end and not an edit/write tool
  if (
    !result.success &&
    (event === "tool_call" || event === "agent_end") &&
    (!toolName || !NON_BLOCKING_TOOLS.has(toolName))
  ) {
    const reason = result.stderr || result.stdout || "Hook failed";
    return {
      block: true,
      reason: `Hook failed: ${result.group}: ${result.command}\n${reason}`,
    };
  }

  return { block: false, reason: "" };
}

/**
 * Extract additional context from hook output.
 */
function getAdditionalContext(result: HookResult): string | undefined {
  return result.output?.hookSpecificOutput?.additionalContext;
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
  const filePath = getInputField(input, "path");
  const vars: HookVariables = { file: filePath, tool: toolName, cwd: ctx.cwd };

  // Build JSON input for hooks
  const hookInput = buildHookInput(
    event,
    ctx,
    toolName,
    input,
    toolCallId,
    toolResponse,
  );

  const results: HookResult[] = [];
  const additionalContexts: string[] = [];

  for (const group of config) {
    if (!(await isGroupActive(group.pattern, ctx.cwd))) continue;

    for (const rule of group.hooks) {
      if (rule.event !== event) continue;
      if (!doesRuleMatch(rule, toolName, input)) continue;

      const result = await runHook(pi, rule, group, ctx, vars, hookInput);

      // Check for blocking
      const blockCheck = shouldBlock(result, event, toolName);
      if (blockCheck.block) {
        // For agent_end, send error to agent to trigger a new turn for fixing
        if (event === "agent_end") {
          pi.sendMessage(
            {
              customType: "hook-error",
              content: `Hook error:\n${blockCheck.reason}`,
              display: true,
            },
            { triggerTurn: true },
          );
          return undefined;
        }
        return { block: true, reason: blockCheck.reason };
      }

      // Collect additional context
      const additionalContext = getAdditionalContext(result);
      if (additionalContext) {
        additionalContexts.push(additionalContext);
      }

      // Show system messages
      if (result.output?.systemMessage) {
        pi.sendMessage(
          {
            customType: "hook-warning",
            content: result.output.systemMessage,
            display: true,
          },
          { triggerTurn: false },
        );
      }

      // Collect results for notification (unless suppressed)
      if (rule.notify !== false && !result.output?.suppressOutput) {
        results.push(result);
      }
    }
  }

  // Send additional context as a message to Claude
  if (additionalContexts.length > 0) {
    pi.sendMessage(
      {
        customType: "hook-context",
        content: additionalContexts.join("\n\n"),
        display: false,
      },
      { triggerTurn: false },
    );
  }

  // Send hook results notification
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
      const icon = r.success ? pc.green("✓") : pc.red("✗");
      const cmd = r.success ? pc.dim(r.command) : pc.yellow(r.command);
      lines.push(`${icon} ${cmd}`);

      // Show output only on failure (stderr preferred, fallback to stdout)
      if (!r.success) {
        const displayOutput = r.stderr || r.stdout;
        if (displayOutput && !r.output?.suppressOutput) {
          // Don't show raw JSON output
          const isJson = displayOutput.trim().startsWith("{");
          if (!isJson) {
            lines.push(pc.red(displayOutput));
          }
        }
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
    if (SKIP_TOOLS.has(event.toolName)) return;
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
    if (SKIP_TOOLS.has(event.toolName)) return;

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

  pi.on("agent_end", async (event: AgentEndEvent, ctx) => {
    if (abortedInCurrentTurn || isAbortedAgentEnd(event)) return;
    return processHooks(pi, await getConfig(ctx.cwd), "agent_end", ctx);
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
