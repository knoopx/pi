import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
  TurnEndEvent,
} from "@mariozechner/pi-coding-agent";
import picomatch from "picomatch";
import { readdir } from "node:fs/promises";
import { matchCommandPattern } from "../guardrails/command-parser";
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
 * - Variable substitution (%file%, %tool%, %cwd%)
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

export function containsAbortText(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("operation aborted") ||
    normalized.includes("aborted") ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled")
  );
}

export function extractTextContent(
  content: unknown[] | undefined,
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

export function isAbortedToolResult(event: ToolResultEvent): boolean {
  if (!event.isError) return false;
  return containsAbortText(extractTextContent(event.content));
}

export function isAbortedTurnEnd(event: TurnEndEvent): boolean {
  const message = (event as { message?: unknown }).message as
    | {
        role?: string;
        stopReason?: string;
        errorMessage?: string;
      }
    | undefined;

  if (!message) return false;
  if (message.role === "assistant" && message.stopReason === "aborted")
    return true;

  return containsAbortText(message.errorMessage ?? "");
}

export function isAbortedAgentEnd(event: AgentEndEvent): boolean {
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
    if (newVersion !== currentVersion) currentVersion = newVersion;
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
    const files = await readdir(root);
    // Check if any file matches the glob pattern
    return files.some((file) =>
      picomatch.isMatch(file, pattern, { dot: true }),
    );
  } catch {
    return false;
  }
}

export function substituteVariables(
  command: string,
  vars: HookVariables,
): string {
  return command
    .replace(/%file%/g, vars.file ?? "")
    .replace(/%tool%/g, vars.tool ?? "")
    .replace(/%cwd%/g, vars.cwd);
}

export function doesRuleMatch(
  rule: HookRule,
  toolName?: string,
  input?: unknown,
): boolean {
  // No context means match everything
  if (!rule.context) return true;

  if (!rule.pattern) return true;

  // Command context uses token pattern matching (`?`, `*`, `{a,b}`)
  if (rule.context === "command") {
    const command =
      toolName === "bash" ? getInputField(input, "command") : undefined;
    if (!command) return false;
    return matchCommandPattern(command, rule.pattern);
  }

  const targetValue = getContextValue(rule.context, toolName, input);
  if (targetValue === undefined) return false;

  return matchValuePattern(targetValue, rule.pattern);
}

export function matchValuePattern(value: string, pattern: string): boolean {
  // New token pattern syntax support for non-command contexts
  if (matchCommandPattern(value, pattern)) return true;

  // Glob pattern matching (e.g., *.js, *.{ts,tsx})
  // Check if basename matches the glob pattern
  const basename = value.split(/[\/\\]/).pop() ?? value;
  return picomatch.isMatch(basename, pattern);
}

export function getContextValue(
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

export function getInputField(
  input: unknown,
  field: string,
): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return value != null ? String(value) : undefined;
}

/**
 * Build JSON input for hook stdin (Claude Code compatible format).
 */
export function buildHookInput(
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

  if (toolName) hookInput.tool_name = toolName;

  if (input && typeof input === "object")
    hookInput.tool_input = input as Record<string, unknown>;

  if (toolCallId) hookInput.tool_call_id = toolCallId;

  if (toolResponse)
    hookInput.tool_response = {
      content: toolResponse.content,
      details: toolResponse.details as Record<string, unknown> | undefined,
      isError: toolResponse.isError,
    };

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

  // Skip if placeholders weren't substituted
  if (/%[A-Za-z_][A-Za-z0-9_]*%/.test(command))
    return {
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      output: undefined,
      group: group.group,
      command,
    };

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
 * Check if exit code 2 indicates a block
 */
function checkExitCodeBlock(
  result: HookResult,
): { block: boolean; reason: string } | null {
  if (result.exitCode === 2)
    return {
      block: true,
      reason:
        result.stderr || `Hook blocked: ${result.group}: ${result.command}`,
    };
  return null;
}

/**
 * Check JSON output for blocking decisions
 */
function checkJsonBlock(
  result: HookResult,
  event: HookEvent,
): { block: boolean; reason: string } | null {
  if (!result.output) return null;
  const { output } = result;

  if (output.continue === false)
    return {
      block: true,
      reason: output.stopReason || "Hook stopped processing",
    };

  if (output.decision === "block" && output.reason)
    return { block: true, reason: output.reason };

  if (event === "tool_call" && output.hookSpecificOutput) {
    const { permissionDecision, permissionDecisionReason } =
      output.hookSpecificOutput;
    if (permissionDecision === "deny")
      return {
        block: true,
        reason: permissionDecisionReason || "Hook denied permission",
      };
  }

  return null;
}

/**
 * Check if non-zero exit code should block for tool_call/agent_end
 */
function checkErrorBlock(
  result: HookResult,
  event: HookEvent,
  toolName?: string,
): { block: boolean; reason: string } | null {
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
  return null;
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
  const exitBlock = checkExitCodeBlock(result);
  if (exitBlock) return exitBlock;

  const jsonBlock = checkJsonBlock(result, event);
  if (jsonBlock) return jsonBlock;

  const errorBlock = checkErrorBlock(result, event, toolName);
  if (errorBlock) return errorBlock;

  return { block: false, reason: "" };
}

/**
 * Extract additional context from hook output.
 */
function getAdditionalContext(result: HookResult): string | undefined {
  return result.output?.hookSpecificOutput?.additionalContext;
}

interface HookProcessState {
  results: HookResult[];
  additionalContexts: string[];
}

/**
 * Check if a rule should be executed
 */
function shouldExecuteRule(
  rule: HookRule,
  event: HookEvent,
  toolName?: string,
  input?: unknown,
): boolean {
  if (rule.event !== event) return false;
  if (!doesRuleMatch(rule, toolName, input)) return false;
  return true;
}

/**
 * Process a single hook execution
 */
async function processHookExecution(
  pi: ExtensionAPI,
  rule: HookRule,
  group: HooksGroup,
  ctx: ExtensionContext,
  vars: HookVariables,
  hookInput: HookInput,
  event: HookEvent,
  state: HookProcessState,
  toolName?: string,
): Promise<BlockResult | undefined> {
  const result = await runHook(pi, rule, group, ctx, vars, hookInput);
  state.results.push(result);

  const blockCheck = shouldBlock(result, event, toolName);
  if (blockCheck.block) {
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

  const additionalContext = getAdditionalContext(result);
  if (additionalContext) state.additionalContexts.push(additionalContext);

  if (result.output?.systemMessage)
    pi.sendMessage(
      {
        customType: "hook-warning",
        content: result.output.systemMessage,
        display: true,
      },
      { triggerTurn: false },
    );

  return undefined;
}

/**
 * Process all hooks for an event
 */
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
  const hookInput = buildHookInput(
    event,
    ctx,
    toolName,
    input,
    toolCallId,
    toolResponse,
  );
  const state: HookProcessState = { results: [], additionalContexts: [] };

  for (const group of config) {
    if (!(await isGroupActive(group.pattern, ctx.cwd))) continue;

    for (const rule of group.hooks) {
      if (!shouldExecuteRule(rule, event, toolName, input)) continue;

      const blockResult = await processHookExecution(
        pi,
        rule,
        group,
        ctx,
        vars,
        hookInput,
        event,
        state,
        toolName,
      );
      if (blockResult !== undefined) return blockResult;
    }
  }

  if (state.additionalContexts.length > 0)
    pi.sendMessage(
      {
        customType: "hook-context",
        content: state.additionalContexts.join("\n\n"),
        display: false,
      },
      { triggerTurn: false },
    );

  if (state.results.length > 0) sendHookResults(pi, state.results);

  return undefined;
}

function groupHookResults(results: HookResult[]): Map<string, HookResult[]> {
  const grouped = new Map<string, HookResult[]>();
  for (const r of results) {
    const list = grouped.get(r.group) ?? [];
    list.push(r);
    grouped.set(r.group, list);
  }
  return grouped;
}

function shouldShowOutput(r: HookResult): boolean {
  if (r.success) return false;
  const displayOutput = r.stderr || r.stdout;
  if (!displayOutput || r.output?.suppressOutput) return false;
  // Don't show raw JSON output
  const isJson = displayOutput.trim().startsWith("{");
  return !isJson;
}

function formatHookResult(r: HookResult): string[] {
  const lines: string[] = [];
  const icon = r.success ? "✓" : "✗";
  lines.push(`${icon} ${r.command}`);

  if (shouldShowOutput(r)) {
    const displayOutput = r.stderr || r.stdout;
    if (displayOutput) lines.push(displayOutput);
  }

  return lines;
}

function sendHookResults(pi: ExtensionAPI, results: HookResult[]): void {
  const grouped = groupHookResults(results);
  const lines: string[] = [];

  for (const [group, hooks] of grouped) {
    lines.push(`[${group}]`);
    for (const r of hooks) {
      lines.push(...formatHookResult(r));
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
