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

  if (checkContinueBlock(output)) return checkContinueBlock(output);
  if (checkDecisionBlock(output)) return checkDecisionBlock(output);
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
