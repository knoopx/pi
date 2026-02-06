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

export const HookContextSchema = Type.Union([
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
export type HookContext = Static<typeof HookContextSchema>;
export type HookRule = Static<typeof HookRuleSchema>;
export type HooksGroup = Static<typeof HooksGroupSchema>;
export type HooksConfig = Static<typeof HooksConfigSchema>;

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
