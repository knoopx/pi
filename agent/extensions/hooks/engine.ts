import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type {
  HookEvent,
  HookInput,
  HooksConfig,
  HooksGroup,
  HookRule,
} from "./schema";
import type { HookVariables, HookResult, HookProcessState } from "./types";
import { runHook } from "./hook-execution";
import { shouldBlock } from "./blocking-checks";
import { shouldExecuteRule, processHookExecution } from "./processing";
import {
  getInputField,
  buildHookInput,
  isGroupActive,
} from "./pattern-matching";
import { processHookGroupExecution } from "./results";

interface ProcessHooksInput {
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

interface BlockResult {
  block: true;
  reason: string;
}

export async function processHooks(
  pi: ExtensionAPI,
  config: HooksConfig,
  input: ProcessHooksInput,
): Promise<BlockResult | undefined> {
  const filePath = getInputField(input.toolInfo?.input, "path");
  const vars: HookVariables = {
    file: filePath,
    tool: input.toolInfo?.toolName,
    cwd: input.ctx.cwd,
  };
  const hookInput = buildHookInput(
    input.event,
    input.ctx,
    input.toolInfo?.toolName,
    input.toolInfo?.input,
    input.toolInfo?.toolCallId,
    input.toolInfo?.toolResponse,
  );
  const state: HookProcessState = { results: [], additionalContexts: [] };

  await processHookGroupExecution(pi, state, config, async (rule, group) => {
    if (!(await isGroupActive(group.pattern, input.ctx.cwd))) return undefined;
    if (
      !shouldExecuteRule(
        rule,
        input.event,
        input.toolInfo?.toolName,
        input.toolInfo?.input,
      )
    )
      return undefined;

    return processHookExecution(
      pi,
      { rule, group, ctx: input.ctx, vars, hookInput },
      { event: input.event, state, toolName: input.toolInfo?.toolName },
    );
  });

  return undefined;
}
