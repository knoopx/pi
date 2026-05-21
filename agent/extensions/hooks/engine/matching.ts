import { readdir } from "node:fs/promises";
import type { HookEvent, HookInput, HookRule } from "../types/schema";
import type { HookVariables } from "../types/results";
import { matchCommandPattern } from "../../../shared/matching/command-match";
import { matchFileNamePattern } from "../../../shared/matching/pattern";
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
function matchesCommandContext(
  rule: HookRule,
  toolName?: string,
  input?: unknown,
): boolean {
  if (toolName !== "bash") return false;
  if (!rule.pattern) return false;
  const command = getInputField(input, "command");
  if (!command) return false;
  return matchCommandPattern(command, rule.pattern);
}

function hasContextAndPattern(
  rule: HookRule,
): rule is HookRule & { context: string; pattern: string } {
  return !!(rule.context && rule.pattern);
}

export function doesRuleMatch(
  rule: HookRule,
  toolName?: string,
  input?: unknown,
): boolean {
  if (!hasContextAndPattern(rule)) return true;
  if (rule.context === "command")
    return matchesCommandContext(rule, toolName, input);

  const context = rule.context;
  const pattern = rule.pattern;
  const targetValue = getContextValue(context, toolName, input);
  if (targetValue === undefined) return false;
  return matchValuePattern(context, targetValue, pattern);
}
export function matchValuePattern(
  context: string,
  value: string,
  pattern: string,
): boolean {
  if (context === "file_name") return matchFileNamePattern(value, pattern);
  return matchCommandPattern(value, pattern);
}
function resolveCommandContext(
  toolName: string | undefined,
  input: unknown,
): string | undefined {
  return toolName === "bash" ? getInputField(input, "command") : undefined;
}

export function getContextValue(
  context: string,
  toolName?: string,
  input?: unknown,
): string | undefined {
  if (context === "command") return resolveCommandContext(toolName, input);
  switch (context) {
    case "tool_name":
      return toolName;
    case "file_name":
      return getInputField(input, "path");
    default:
      return undefined;
  }
}
function isPlainObjectInput(input: unknown): boolean {
  return !!input && typeof input === "object";
}

export function getInputField(
  input: unknown,
  field: string,
): string | undefined {
  if (!isPlainObjectInput(input)) return undefined;
  const raw = (input as Record<string, unknown>)[field];
  if (raw == null) return undefined;
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw as string | number | boolean);
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
function applyToolResponse(
  response: NonNullable<BuildHookInputOptions["toolResponse"]>,
): HookInput["tool_response"] {
  return {
    content: response.content,
    details: response.details as Record<string, unknown> | undefined,
    isError: response.isError,
  };
}

function setToolFields(
  hookInput: HookInput,
  options: BuildHookInputOptions,
): void {
  if (options.toolName) hookInput.tool_name = options.toolName;
  if (options.toolCallId) hookInput.tool_call_id = options.toolCallId;
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

  setToolFields(hookInput, options);
  if (isPlainObject(options.input)) {
    hookInput.tool_input = options.input as Record<string, unknown>;
  }
  if (options.toolResponse) {
    hookInput.tool_response = applyToolResponse(options.toolResponse);
  }

  return hookInput;
}

function isPlainObject(value: unknown): boolean {
  return !!value && typeof value === "object";
}
