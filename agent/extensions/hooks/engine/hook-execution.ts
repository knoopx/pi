import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { HookEvent, HookRule, HooksConfig } from "../types/schema";
import type { HookProcessState, HookVariables } from "../types/results";
import { shouldExecuteRule, processHookExecution } from "./process";
import { getInputField, buildHookInput, isGroupActive } from "./matching";
import { processHookGroupExecution } from "./output";
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
function shouldProcessRule(
  rule: HookRule,
  event: HookEvent,
  toolName: string | undefined,
  toolInput: unknown,
): boolean {
  return shouldExecuteRule(rule, event, toolName, toolInput);
}

async function evaluateHookRule(
  rule: HookRule,
  group: import("../types/schema").HooksGroup,
  input: ProcessHooksInput,
  ctx: ExtensionContext,
): Promise<boolean> {
  if (!(await isGroupActive(group.pattern, ctx.cwd))) return false;
  return shouldProcessRule(
    rule,
    input.event,
    input.toolInfo?.toolName,
    input.toolInfo?.input,
  );
}

export async function runEngineHooks(
  pi: ExtensionAPI,
  config: HooksConfig,
  input: ProcessHooksInput,
): Promise<BlockResult | undefined> {
  const ctx = input.ctx;
  const toolInfo = input.toolInfo ?? {};
  const filePath = getInputField(toolInfo.input, "path");
  const vars: HookVariables = {
    file: filePath,
    tool: toolInfo.toolName,
    cwd: ctx.cwd,
  };
  const hookInput = buildHookInput(input.event, ctx, {
    toolName: toolInfo.toolName,
    input: toolInfo.input,
    toolCallId: toolInfo.toolCallId,
    toolResponse: toolInfo.toolResponse,
  });
  const state: HookProcessState = { results: [], additionalContexts: [] };

  await processHookGroupExecution(
    pi,
    ctx,
    state,
    config,
    async (rule, group) => {
      if (!(await evaluateHookRule(rule, group, input, ctx))) return undefined;
      return processHookExecution(
        pi,
        { rule, group, ctx, vars, hookInput },
        {
          event: input.event,
          state,
          toolName: toolInfo.toolName,
        },
      );
    },
  );

  return undefined;
}
