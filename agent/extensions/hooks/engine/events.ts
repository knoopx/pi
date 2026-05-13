import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
  TurnEndEvent,
} from "@earendil-works/pi-coding-agent";
import type { HookEvent, HooksConfig } from "../types/schema";
import {
  isAbortedToolResult,
  isAbortedTurnEnd,
  isAbortedAgentEnd,
} from "./abort";
import { runEngineHooks } from "./core";

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
): Promise<{ block: true; reason: string } | undefined> {
  return runEngineHooks(params.pi, params.config, {
    event: params.event,
    ctx: params.ctx,
    toolInfo: params.toolInfo,
  });
}

function registerSessionHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean,
  abortedInCurrentTurnRef: { value: boolean },
): void {
  const sessionEvents: [event: HookEvent, checkAbort: boolean][] = [
    ["session_start", false],
    ["session_shutdown", true],
    ["agent_start", false],
  ];
  for (const [event, checkAbort] of sessionEvents) {
    (
      pi.on as <E>(
        event: string,
        handler: (event: E, ctx: ExtensionContext) => Promise<void>,
      ) => void
    )(event, async (_event: unknown, ctx: ExtensionContext) => {
      if (!isEnabled()) return;
      if (checkAbort && abortedInCurrentTurnRef.value) return;
      await runProcessHooks({ pi, config: await getConfig(), event, ctx });
    });
  }
}

function registerToolHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean,
  abortedInCurrentTurnRef: { value: boolean },
): void {
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    if (!isEnabled()) return;
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

export function registerEventHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean,
): void {
  const abortedInCurrentTurnRef = { value: false };

  registerSessionHandlers(pi, getConfig, isEnabled, abortedInCurrentTurnRef);
  registerToolHandlers(pi, getConfig, isEnabled, abortedInCurrentTurnRef);
  registerTurnHandlers(pi, getConfig, isEnabled, abortedInCurrentTurnRef);
}
