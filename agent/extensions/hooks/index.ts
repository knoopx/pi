import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ThemeColor,
  ToolCallEvent,
  ToolResultEvent,
  TurnEndEvent,
} from "@mariozechner/pi-coding-agent";
import { createThemeFg, notifyAuditResult } from "../../shared/audit-utils";

import { configLoader, loadHooksSettings, saveHooksSettings } from "./config";
import type { HookEvent, HooksConfig } from "./schema";
import { getSkipTools } from "./results.js";
import {
  isAbortedToolResult,
  isAbortedTurnEnd,
  isAbortedAgentEnd,
} from "./abort-detection.js";
import { isGroupActive } from "./pattern-matching.js";
import {
  matchCommandPattern,
  matchFileNamePattern,
} from "../../shared/pattern-matching";
import { runEngineHooks } from "./engine.js";

function registerSessionHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean,
  abortedInCurrentTurnRef: { value: boolean },
): void {
  pi.on("session_start", async (_event, ctx) => {
    if (!isEnabled()) return;
    await runProcessHooks({
      pi,
      config: await getConfig(),
      event: "session_start",
      ctx,
    });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!isEnabled() || abortedInCurrentTurnRef.value) return;
    await runProcessHooks({
      pi,
      config: await getConfig(),
      event: "session_shutdown",
      ctx,
    });
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (!isEnabled()) return;
    await runProcessHooks({
      pi,
      config: await getConfig(),
      event: "agent_start",
      ctx,
    });
  });
}

function registerToolHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean,
  abortedInCurrentTurnRef: { value: boolean },
): void {
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    if (!isEnabled()) return;
    if (getSkipTools().has(event.toolName)) return;
    return runProcessHooks({
      pi,
      config: await getConfig(),
      event: "tool_call",
      ctx,
      toolInfo: {
        toolName: event.toolName,
        input: event.input,
        toolCallId: event.toolCallId,
      },
    });
  });

  pi.on("tool_result", async (event: ToolResultEvent, ctx) => {
    if (!isEnabled()) return;
    if (getSkipTools().has(event.toolName)) return;

    if (isAbortedToolResult(event)) {
      abortedInCurrentTurnRef.value = true;
      return;
    }

    await runProcessHooks({
      pi,
      config: await getConfig(),
      event: "tool_result",
      ctx,
      toolInfo: {
        toolName: event.toolName,
        input: event.input,
        toolCallId: event.toolCallId,
        toolResponse: {
          content: event.content,
          details: event.details,
          isError: event.isError,
        },
      },
    });
  });

  (
    pi as ExtensionAPI & {
      on(
        event: "agent_end",
        handler: (event: AgentEndEvent, ctx: ExtensionContext) => Promise<void>,
      ): void;
    }
  ).on("agent_end", async (event: AgentEndEvent, ctx: ExtensionContext) => {
    if (
      !isEnabled() ||
      abortedInCurrentTurnRef.value ||
      isAbortedAgentEnd(event)
    )
      return;
    await runProcessHooks({
      pi,
      config: await getConfig(),
      event: "agent_end",
      ctx,
    });
  });
}

function registerTurnHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean,
  abortedInCurrentTurnRef: { value: boolean },
): void {
  pi.on("turn_start", async (_event, ctx) => {
    if (!isEnabled()) return;
    abortedInCurrentTurnRef.value = false;
    await runProcessHooks({
      pi,
      config: await getConfig(),
      event: "turn_start",
      ctx,
    });
  });

  pi.on("turn_end", async (event: TurnEndEvent, ctx) => {
    if (
      !isEnabled() ||
      abortedInCurrentTurnRef.value ||
      isAbortedTurnEnd(event)
    )
      return;
    await runProcessHooks({
      pi,
      config: await getConfig(),
      event: "turn_end",
      ctx,
    });
  });
}

export default async function hooksExtension(pi: ExtensionAPI): Promise<void> {
  const getConfig = (): Promise<HooksConfig> => {
    configLoader.load();
    return Promise.resolve(configLoader.getConfig());
  };

  const hooksEnabledRef = {
    value: (await loadHooksSettings()).enabled,
  };

  registerEventHandlers(pi, getConfig, () => hooksEnabledRef.value);
  registerCommands(pi, hooksEnabledRef);
}

interface BlockResult {
  block: true;
  reason: string;
}

interface ProcessHooksParams {
  pi: ExtensionAPI;
  config: HooksConfig;
  event: HookEvent;
  ctx: ExtensionContext;
  toolInfo?: {
    toolName?: string;
    input?: unknown;
    toolCallId?: string;
    toolResponse?: {
      content?: unknown[];
      details?: unknown;
      isError?: boolean;
    };
  };
}

function runProcessHooks(
  params: ProcessHooksParams,
): Promise<BlockResult | undefined> {
  return runEngineHooks(params.pi, params.config, {
    event: params.event,
    ctx: params.ctx,
    toolInfo: params.toolInfo,
  });
}

function registerEventHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean,
): void {
  const abortedInCurrentTurnRef = { value: false };

  registerSessionHandlers(pi, getConfig, isEnabled, abortedInCurrentTurnRef);
  registerToolHandlers(pi, getConfig, isEnabled, abortedInCurrentTurnRef);
  registerTurnHandlers(pi, getConfig, isEnabled, abortedInCurrentTurnRef);
}

async function handleHooksAudit(
  _args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const config = configLoader.getConfig();

  if (config.length === 0) {
    ctx.ui?.notify("No hooks configured", "info");
    return;
  }

  const fg = createThemeFg(ctx.ui.theme);
  const auditResult = await auditHooksConfig(config, ctx.cwd, fg);
  notifyAuditResult(ctx, auditResult, fg);
}

interface AuditResult {
  lines: string[];
  errors: number;
}

async function auditHooksConfig(
  config: ReturnType<typeof configLoader.getConfig>,
  cwd: string,
  fg: (color: ThemeColor, text: string) => string,
): Promise<AuditResult> {
  const lines: string[] = [];
  let errors = 0;

  for (const group of config) {
    const isActive = await isGroupActive(group.pattern, cwd);
    lines.push(renderGroupHeader(fg, group, isActive));

    for (let i = 0; i < group.hooks.length; i++) {
      const hook = group.hooks[i];
      lines.push(renderHookLine(hook));
      errors += validateHookPattern(hook, { index: i, fg, lines });
    }
  }

  return { lines, errors };
}

function renderGroupHeader(
  fg: (color: ThemeColor, text: string) => string,
  group: { group: string; pattern: string },
  isActive: boolean,
): string {
  const statusIcon = isActive ? "✓" : "✗";
  const statusColor = isActive ? "success" : "error";
  return `${fg(statusColor, statusIcon)} ${group.group} (${group.pattern})`;
}

function renderHookLine(hook: {
  event: string;
  context?: string;
  pattern?: string;
  command: string;
}): string {
  const context = hook.context ? ` [${hook.context}: ${hook.pattern}]` : "";
  return `  → ${hook.event}${context}: ${hook.command}`;
}

interface PatternValidationCtx {
  index: number;
  fg: (color: ThemeColor, text: string) => string;
  lines: string[];
}

function validateHookPattern(
  hook: NonNullable<
    ReturnType<typeof configLoader.getConfig>
  >[number]["hooks"][number],
  ctx: PatternValidationCtx,
): number {
  if (!hook.context || !hook.pattern) return 0;
  return validatePatternWithContext(hook.context, hook.pattern, ctx);
}

function validatePatternWithContext(
  context: string,
  pattern: string,
  ctx: PatternValidationCtx,
): number {
  const matcher = buildPatternMatcher(context, pattern);
  if (!tryValidate(matcher, "test", ctx)) {
    return 1;
  }
  if (context === "command") {
    return tryValidate(matcher, "echo test", ctx) ? 0 : 1;
  }
  return 0;
}

function buildPatternMatcher(
  context: string,
  pattern: string,
): (input: string) => void {
  if (context === "file_name") {
    return (input: string) => matchFileNamePattern(input, pattern);
  }
  return (input: string) => matchCommandPattern(input, pattern);
}

function tryValidate(
  matcher: (input: string) => void,
  input: string,
  ctx: PatternValidationCtx,
): boolean {
  try {
    matcher(input);
    return true;
  } catch (e) {
    ctx.lines.push(
      `    ${ctx.fg("error", "✗")} invalid pattern at hooks[${ctx.index}]: ${(e as Error).message}`,
    );
    return false;
  }
}

function createHooksHandler(ref: { value: boolean }) {
  return async function handler(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const action = args.trim().toLowerCase();

    if (action === "on") {
      ref.value = true;
      await saveHooksSettings({ enabled: true });
      ctx.ui?.notify("Hooks enabled", "info");
      return;
    }

    if (action === "off") {
      ref.value = false;
      await saveHooksSettings({ enabled: false });
      ctx.ui?.notify("Hooks disabled", "warning");
      return;
    }

    // No argument — run audit
    await handleHooksAudit(args, ctx);
  };
}

function registerCommands(
  pi: ExtensionAPI,
  hooksEnabledRef: { value: boolean },
): void {
  pi.registerCommand("hooks", {
    description:
      "Audit hooks config, or toggle with on|off (usage: /hooks [on|off])",
    handler: createHooksHandler(hooksEnabledRef),
  });
}
