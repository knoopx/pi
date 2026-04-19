import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { HookInput, HooksGroup, HookRule } from "./schema";
import { parseHookOutput } from "./schema";
import type { HookResult, HookVariables } from "./types";
import { substituteVariables } from "./pattern-matching";

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

  // Skip if placeholders weren't substituted
  if (/%[A-Za-z_][A-Za-z0-9_]*%/.test(command))
    return {
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      output: undefined,
      group: hookRunContext.group.group,
      command,
    };

  const timeout = hookRunContext.rule.timeout ?? 30000;
  const cwd = hookRunContext.ctx.cwd;
  const stdinInput = JSON.stringify(hookRunContext.hookInput);

  try {
    const result = await pi.exec(
      "sh",
      [
        "-c",
        `set -o pipefail; echo '${stdinInput.replace(/'/g, "'\\''")}' | ${command}`,
      ],
      { timeout, cwd },
    );

    const stdout = result.stdout?.trim() ?? "";
    const stderr = result.stderr?.trim() ?? "";
    const output = result.code === 0 ? parseHookOutput(stdout) : undefined;

    return {
      success: result.code === 0,
      exitCode: result.code ?? 1,
      stdout,
      stderr,
      output,
      group: hookRunContext.group.group,
      command,
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      output: undefined,
      group: hookRunContext.group.group,
      command,
    };
  }
}
