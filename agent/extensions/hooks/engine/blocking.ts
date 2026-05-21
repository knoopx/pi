import type { HookEvent } from "../types/schema";
import type { HookResult } from "../types/results";
import { NON_BLOCKING_TOOLS } from "../config/constants";
function checkExitCodeBlock(
  result: HookResult,
): { block: true; reason: string } | null {
  if (result.exitCode === 2)
    return {
      block: true,
      reason:
        result.stderr || `Hook blocked: ${result.group}: ${result.command}`,
    };
  return null;
}
function checkJsonBlock(
  result: HookResult,
  event: HookEvent,
): { block: true; reason: string } | null {
  if (!result.output) return null;
  const { output } = result;

  const continueBlock = checkContinueBlock(output);
  if (continueBlock) return continueBlock;
  const decisionBlock = checkDecisionBlock(output);
  if (decisionBlock) return decisionBlock;
  return checkHookSpecificBlock(event, output);
}

function checkHookSpecificBlock(
  event: HookEvent,
  output: NonNullable<HookResult["output"]>,
): { block: true; reason: string } | null {
  if (event === "tool_call" && output.hookSpecificOutput) {
    return checkPermissionBlock(output.hookSpecificOutput);
  }
  return null;
}
function checkContinueBlock(
  output: NonNullable<HookResult["output"]>,
): { block: true; reason: string } | null {
  if (output.continue !== false) return null;
  return {
    block: true,
    reason: output.stopReason || "Hook stopped processing",
  };
}
function checkDecisionBlock(
  output: NonNullable<HookResult["output"]>,
): { block: true; reason: string } | null {
  if (output.decision !== "block" || !output.reason) return null;
  return { block: true, reason: output.reason };
}
function checkPermissionBlock(
  hookOutput: NonNullable<HookResult["output"]>["hookSpecificOutput"],
): { block: true; reason: string } | null {
  if (!hookOutput || hookOutput.permissionDecision !== "deny") return null;
  return {
    block: true,
    reason: hookOutput.permissionDecisionReason || "Hook denied permission",
  };
}
function isBlockingEvent(event: HookEvent): boolean {
  return event === "tool_call" || event === "agent_end";
}

function isBlockingTool(toolName: string | undefined): boolean {
  return toolName === undefined || !NON_BLOCKING_TOOLS.has(toolName);
}

function checkErrorBlock(
  result: HookResult,
  event: HookEvent,
  toolName?: string,
): { block: true; reason: string } | null {
  if (result.success) return null;
  if (!isBlockingEvent(event)) return null;
  if (!isBlockingTool(toolName)) return null;
  const reason = resolveHookErrorReason(result);
  return {
    block: true,
    reason: `Hook failed: ${result.group}: ${result.command}\n${reason}`,
  };
}

function resolveHookErrorReason(result: HookResult): string {
  return result.stderr || result.stdout || "Hook failed";
}
export function shouldBlock(
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
