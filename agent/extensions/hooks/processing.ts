import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { HookEvent, HooksGroup, HookRule, HookInput } from "./schema";
import { doesRuleMatch } from "./pattern-matching";
import type { HookProcessState } from "./types";
import { runHook } from "./hook-execution";
import { shouldBlock } from "./blocking-checks";

export function shouldExecuteRule(
  rule: HookRule,
  event: HookEvent,
  toolName?: string,
  input?: unknown,
): boolean {
  if (rule.event !== event) return false;
  if (!doesRuleMatch(rule, toolName, input)) return false;
  return true;
}

export async function processHookExecution(
  pi: ExtensionAPI,
  hookRunContext: {
    rule: HookRule;
    group: HooksGroup;
    ctx: ExtensionContext;
    vars: import("./types").HookVariables;
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

  const blockCheck = shouldBlock(
    result,
    executionContext.event,
    executionContext.toolName,
  );
  if (blockCheck.block) {
    if (executionContext.event === "agent_end") {
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
  if (additionalContext)
    executionContext.state.additionalContexts.push(additionalContext);

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

function getAdditionalContext(
  result: import("./types").HookResult,
): string | undefined {
  return result.output?.hookSpecificOutput?.additionalContext;
}
