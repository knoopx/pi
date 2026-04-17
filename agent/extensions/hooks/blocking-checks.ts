import type { HookEvent } from "./schema";
import type { HookResult } from "./types";
import { NON_BLOCKING_TOOLS } from "./constants";

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

function checkErrorBlock(
  result: HookResult,
  event: HookEvent,
  toolName?: string,
): { block: true; reason: string } | null {
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

function getAdditionalContext(result: HookResult): string | undefined {
  return result.output?.hookSpecificOutput?.additionalContext;
}
