import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type {
  HookEvent,
  HooksGroup,
  HookRule,
  HookInput,
} from "../types/schema";
import { doesRuleMatch } from "./matching";
import type {
  HookProcessState,
  HookVariables,
  HookResult,
} from "../types/results";
import { runHook } from "./execute";
import { shouldBlock } from "./blocking";
import { READ_ONLY_TOOLS } from "../config/constants";
function isReadOnlyToolExcluded(rule: HookRule, toolName?: string): boolean {
  return READ_ONLY_TOOLS.has(toolName ?? "") && rule.context === "file_name";
}

export function shouldExecuteRule(
  rule: HookRule,
  event: HookEvent,
  toolName?: string,
  input?: unknown,
): boolean {
  if (rule.event !== event) return false;
  if (isReadOnlyToolExcluded(rule, toolName)) return false;
  return doesRuleMatch(rule, toolName, input);
}
async function handleBlockResult(
  pi: ExtensionAPI,
  event: HookEvent,
  reason: string,
): Promise<{ block: true; reason: string } | undefined> {
  if (event === "agent_end") {
    pi.sendMessage(
      {
        customType: "hook-error",
        content: `Hook error:\n${reason}`,
        display: true,
      },
      { triggerTurn: true },
    );
    return undefined;
  }
  return { block: true, reason };
}

function sendSystemMessage(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  message: string,
): void {
  if (!message) return;
  pi.sendMessage(
    {
      customType: "hook-warning",
      content: message,
      display: true,
    },
    { triggerTurn: false },
  );
  ctx.ui.notify("Hook warning", "info");
}

export async function processHookExecution(
  pi: ExtensionAPI,
  hookRunContext: {
    rule: HookRule;
    group: HooksGroup;
    ctx: ExtensionContext;
    vars: HookVariables;
    hookInput: HookInput;
  },
  executionContext: {
    event: HookEvent;
    state: HookProcessState;
    toolName?: string;
  },
): Promise<{ block: true; reason: string } | undefined> {
  const result = await runHook(pi, hookRunContext);
  executionContext.state.results.push(result);
  const blockResult = await handleBlockCheck(
    pi,
    result,
    executionContext.event,
    executionContext.toolName,
  );
  if (blockResult) return blockResult;
  collectPostHookData(result, executionContext.state);
  sendSystemMessage(pi, hookRunContext.ctx, result.output?.systemMessage ?? "");
}

async function handleBlockCheck(
  pi: ExtensionAPI,
  result: HookResult,
  event: HookEvent,
  toolName?: string,
): Promise<{ block: true; reason: string } | undefined> {
  const blockCheck = shouldBlock(result, event, toolName);
  if (!blockCheck.block) return;
  return handleBlockResult(pi, event, blockCheck.reason);
}

function collectPostHookData(
  result: HookResult,
  state: HookProcessState,
): void {
  const additionalContext = getAdditionalContext(result);
  if (additionalContext) {
    state.additionalContexts.push(additionalContext);
  }
}
function getAdditionalContext(result: HookResult): string | undefined {
  return result.output?.hookSpecificOutput?.additionalContext;
}
