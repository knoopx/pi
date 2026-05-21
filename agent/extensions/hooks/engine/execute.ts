import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { HookInput, HooksGroup, HookRule, HookOutput } from "../types/schema";
import { parseHookOutput } from "../config/validation";
import type { HookResult, HookVariables } from "../types/results";
import { substituteVariables } from "./matching";
function buildHookResult(
  group: string,
  command: string,
  success: boolean,
  exitCode: number,
  stdout: string,
  stderr: string,
  output?: HookOutput,
): HookResult {
  return { success, exitCode, stdout, stderr, output, group, command };
}

function hasUnresolvedVars(command: string): boolean {
  return /%[A-Za-z_][A-Za-z0-9_]*%/.test(command);
}

async function executeHookCommand(
  pi: ExtensionAPI,
  command: string,
  stdinInput: string,
  timeout: number,
  cwd: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const result = await pi.exec(
    "sh",
    [
      "-c",
      `set -o pipefail; echo '${stdinInput.replace(/'/g, "'\\''")}' | ${command}`,
    ],
    { timeout, cwd },
  );
  return {
    code: result.code ?? null,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
  };
}

function buildSuccessResult(
  group: string,
  command: string,
  code: number | null,
  stdout: string,
  stderr: string,
): HookResult {
  const output = code === 0 ? parseHookOutput(stdout) : undefined;
  return buildHookResult(
    group,
    command,
    code === 0,
    code ?? 1,
    stdout,
    stderr,
    output,
  );
}

function buildErrorResult(
  group: string,
  command: string,
  error: unknown,
): HookResult {
  return buildHookResult(
    group,
    command,
    false,
    1,
    "",
    error instanceof Error ? error.message : String(error),
  );
}

export async function runHook(
  pi: ExtensionAPI,
  hookRunContext: {
    rule: HookRule;
    group: HooksGroup;
    ctx: ExtensionContext;
    vars: HookVariables;
    hookInput: HookInput;
  },
): Promise<HookResult> {
  const command = substituteVariables(
    hookRunContext.rule.command,
    hookRunContext.vars,
  );
  const group = hookRunContext.group.group;

  if (hasUnresolvedVars(command)) {
    return buildHookResult(group, command, true, 0, "", "");
  }

  const timeout = hookRunContext.rule.timeout ?? 30000;
  const cwd = hookRunContext.ctx.cwd;
  const stdinInput = JSON.stringify(hookRunContext.hookInput);

  try {
    const { code, stdout, stderr } = await executeHookCommand(
      pi,
      command,
      stdinInput,
      timeout,
      cwd,
    );
    return buildSuccessResult(group, command, code, stdout, stderr);
  } catch (error) {
    return buildErrorResult(group, command, error);
  }
}
