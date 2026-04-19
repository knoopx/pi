import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { HookEvent, HooksConfig } from "./schema";
import type { HookProcessState, HookVariables } from "./types";
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

export async function runEngineHooks(
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
  const hookInput = buildHookInput(input.event, input.ctx, {
    toolName: input.toolInfo?.toolName,
    input: input.toolInfo?.input,
    toolCallId: input.toolInfo?.toolCallId,
    toolResponse: input.toolInfo?.toolResponse,
  });
  const state: HookProcessState = { results: [], additionalContexts: [] };
  const ctx = input.ctx;

  await processHookGroupExecution(pi, state, config, async (rule, group) => {
    if (!(await isGroupActive(group.pattern, ctx.cwd))) return undefined;
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
      { rule, group, ctx, vars, hookInput },
      {
        event: input.event,
        state,
        toolName: input.toolInfo?.toolName,
      },
    );
  });

  return undefined;
}
