import picomatch from "picomatch";
import { readdir } from "node:fs/promises";
import type { HookEvent, HookInput, HookRule } from "./schema";
import type { HookVariables } from "./types";
import { matchCommandPattern } from "../../shared/pattern-matching";

export function isGroupActive(pattern: string, root: string): Promise<boolean> {
  if (pattern === "*") return Promise.resolve(true);

  return readdir(root)
    .then((files) =>
      files.some((file) => picomatch.isMatch(file, pattern, { dot: true })),
    )
    .catch(() => false);
}

export function substituteVariables(
  command: string,
  vars: HookVariables,
): string {
  return command
    .replace(/%file%/g, vars.file ?? "")
    .replace(/%tool%/g, vars.tool ?? "")
    .replace(/%cwd%/g, vars.cwd);
}

export function doesRuleMatch(
  rule: HookRule,
  toolName?: string,
  input?: unknown,
): boolean {
  // No context filter means match everything
  if (!rule.context || !rule.pattern) return true;

  // Command context uses token pattern matching (`?`, `*`, `{a,b}`)
  if (rule.context === "command") {
    if (toolName !== "bash") return false;
    const command = getInputField(input, "command");
    if (!command) return false;
    return matchCommandPattern(command, rule.pattern);
  }

  const targetValue = getContextValue(rule.context, toolName, input);
  if (targetValue === undefined) return false;

  return matchValuePattern(targetValue, rule.pattern);
}

export function matchValuePattern(value: string, pattern: string): boolean {
  // New token pattern syntax support for non-command contexts
  if (matchCommandPattern(value, pattern)) return true;

  const basename = value.split(/[\/\\]/).pop() ?? value;
  return picomatch.isMatch(basename, pattern);
}

export function getContextValue(
  context: string,
  toolName?: string,
  input?: unknown,
): string | undefined {
  switch (context) {
    case "tool_name":
      return toolName;
    case "file_name":
      return getInputField(input, "path");
    case "command":
      return toolName === "bash" ? getInputField(input, "command") : undefined;
    default:
      return undefined;
  }
}

export function getInputField(
  input: unknown,
  field: string,
): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return value != null ? String(value) : undefined;
}

export function buildHookInput(
  event: HookEvent,
  ctx: { cwd: string },
  toolName?: string,
  input?: unknown,
  toolCallId?: string,
  toolResponse?: {
    content?: unknown[];
    details?: unknown;
    isError?: boolean;
  },
): HookInput {
  const hookInput: HookInput = {
    cwd: ctx.cwd,
    hook_event_name: event,
  };

  if (toolName) hookInput.tool_name = toolName;

  if (input && typeof input === "object")
    hookInput.tool_input = input as Record<string, unknown>;

  if (toolCallId) hookInput.tool_call_id = toolCallId;

  if (toolResponse)
    hookInput.tool_response = {
      content: toolResponse.content,
      details: toolResponse.details as Record<string, unknown> | undefined,
      isError: toolResponse.isError,
    };

  return hookInput;
}
