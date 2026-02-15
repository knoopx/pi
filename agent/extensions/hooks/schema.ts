import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const HookEventSchema = Type.Union([
  Type.Literal("session_start"),
  Type.Literal("session_shutdown"),
  Type.Literal("tool_call"),
  Type.Literal("tool_result"),
  Type.Literal("agent_start"),
  Type.Literal("agent_end"),
  Type.Literal("turn_start"),
  Type.Literal("turn_end"),
]);

const HookContextSchema = Type.Union([
  Type.Literal("tool_name"),
  Type.Literal("file_name"),
  Type.Literal("command"),
]);

export const HookRuleSchema = Type.Object({
  event: HookEventSchema,
  context: Type.Optional(HookContextSchema),
  pattern: Type.Optional(Type.String()),
  command: Type.String(),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number({ minimum: 0 })),
  notify: Type.Optional(Type.Boolean()),
});

export const HooksGroupSchema = Type.Object({
  group: Type.String(),
  pattern: Type.String(),
  hooks: Type.Array(HookRuleSchema),
});

export const HooksConfigSchema = Type.Array(HooksGroupSchema);

export type HookEvent = Static<typeof HookEventSchema>;
type _HookContext = Static<typeof HookContextSchema>;
export type HookRule = Static<typeof HookRuleSchema>;
export type HooksGroup = Static<typeof HooksGroupSchema>;
export type HooksConfig = Static<typeof HooksConfigSchema>;

/**
 * JSON input passed to hooks via stdin (Claude Code compatible).
 */
export interface HookInput {
  /** Current session identifier */
  session_id?: string;
  /** Current working directory */
  cwd: string;
  /** Name of the event that fired */
  hook_event_name: HookEvent;
  /** Tool name (for tool_call, tool_result) */
  tool_name?: string;
  /** Tool input parameters (for tool_call, tool_result) */
  tool_input?: Record<string, unknown>;
  /** Tool call ID (for tool_call, tool_result) */
  tool_call_id?: string;
  /** Tool response (for tool_result) */
  tool_response?: {
    content?: unknown[];
    details?: Record<string, unknown>;
    isError?: boolean;
  };
}

/**
 * JSON output from hooks (Claude Code compatible).
 * Hooks can return structured decisions via JSON on stdout.
 */
export interface HookOutput {
  /** If false, Claude stops processing entirely */
  continue?: boolean;
  /** Message shown to user when continue is false */
  stopReason?: string;
  /** If true, hides stdout from output */
  suppressOutput?: boolean;
  /** Warning message shown to user */
  systemMessage?: string;
  /** Block decision (for tool_call, tool_result, agent_end) */
  decision?: "block";
  /** Reason for blocking */
  reason?: string;
  /** Event-specific output (Claude Code's hookSpecificOutput) */
  hookSpecificOutput?: {
    hookEventName: HookEvent;
    /** Permission decision for tool_call (PreToolUse) */
    permissionDecision?: "allow" | "deny" | "ask";
    /** Reason for permission decision */
    permissionDecisionReason?: string;
    /** Modified tool input (for tool_call) */
    updatedInput?: Record<string, unknown>;
    /** Additional context to inject */
    additionalContext?: string;
  };
}

export function validateConfig(data: unknown): HooksConfig {
  if (!Value.Check(HooksConfigSchema, data)) {
    const errors = [...Value.Errors(HooksConfigSchema, data)];
    const messages = errors.map((e) => `${e.path}: ${e.message}`).join(", ");
    throw new Error(`Invalid hooks config: ${messages}`);
  }
  return data;
}

export function isValidConfig(data: unknown): data is HooksConfig {
  return Value.Check(HooksConfigSchema, data);
}

/**
 * Parse JSON output from hook stdout.
 * Returns undefined if not valid JSON or not an object.
 */
export function parseHookOutput(stdout: string): HookOutput | undefined {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("{")) return undefined;

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    return parsed as HookOutput;
  } catch {
    return undefined;
  }
}
