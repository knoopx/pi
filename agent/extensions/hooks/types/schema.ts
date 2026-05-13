import { Type } from "typebox";
import type { Static } from "typebox";
const HookEventSchema = Type.Union([
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
const HookRuleSchema = Type.Object({
  event: HookEventSchema,
  context: Type.Optional(HookContextSchema),
  pattern: Type.Optional(Type.String()),
  command: Type.String(),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number({ minimum: 0 })),
  notify: Type.Optional(Type.Boolean()),
});
const HooksGroupSchema = Type.Object({
  group: Type.String(),
  pattern: Type.String(),
  hooks: Type.Array(HookRuleSchema),
});
export type HookEvent = Static<typeof HookEventSchema>;
export type HookRule = Static<typeof HookRuleSchema>;
export type HooksGroup = Static<typeof HooksGroupSchema>;
export type HooksConfig = Static<typeof HooksGroupSchema>[];
export interface HookInput {
  session_id?: string;
  cwd: string;
  hook_event_name: HookEvent;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_call_id?: string;
  tool_response?: {
    content?: unknown[];
    details?: Record<string, unknown>;
    isError?: boolean;
  };
}
export interface HookOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: "block";
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: HookEvent;
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
    updatedInput?: Record<string, unknown>;
    additionalContext?: string;
  };
}
