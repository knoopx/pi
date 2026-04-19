import { readdir } from "node:fs/promises";
import type { HookEvent, HookInput, HookRule } from "./schema";
import type { HookVariables } from "./types";
import {
  matchCommandPattern,
  matchFileNamePattern,
} from "../../shared/pattern-matching";

export function isGroupActive(pattern: string, root: string): Promise<boolean> {
  if (pattern === "*") return Promise.resolve(true);

  return readdir(root)
    .then((files) => files.some((file) => matchFileNamePattern(file, pattern)))
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

  return matchValuePattern(rule.context, targetValue, rule.pattern);
}

export function matchValuePattern(
  context: string,
  value: string,
  pattern: string,
): boolean {
  if (context === "file_name") return matchFileNamePattern(value, pattern);
  return matchCommandPattern(value, pattern);
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

interface BuildHookInputOptions {
  toolName?: string;
  input?: unknown;
  toolCallId?: string;
  toolResponse?: {
    content?: unknown[];
    details?: unknown;
    isError?: boolean;
  };
}

export function buildHookInput(
  event: HookEvent,
  ctx: { cwd: string },
  options: BuildHookInputOptions = {},
): HookInput {
  const hookInput: HookInput = {
    cwd: ctx.cwd,
    hook_event_name: event,
  };

  if (options.toolName) hookInput.tool_name = options.toolName;

  if (options.input && typeof options.input === "object")
    hookInput.tool_input = options.input as Record<string, unknown>;

  if (options.toolCallId) hookInput.tool_call_id = options.toolCallId;

  if (options.toolResponse)
    hookInput.tool_response = {
      content: options.toolResponse.content,
      details: options.toolResponse.details as
        | Record<string, unknown>
        | undefined,
      isError: options.toolResponse.isError,
    };

  return hookInput;
}
