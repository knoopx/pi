import { Type } from "typebox";
import { Value } from "typebox/value";
import type { HookOutput, HooksConfig } from "../types/schema";
const HooksConfigSchema = Type.Array(
  Type.Object({
    group: Type.String(),
    pattern: Type.String(),
    hooks: Type.Array(
      Type.Object({
        event: Type.Union([
          Type.Literal("session_start"),
          Type.Literal("session_shutdown"),
          Type.Literal("tool_call"),
          Type.Literal("tool_result"),
          Type.Literal("agent_start"),
          Type.Literal("agent_end"),
          Type.Literal("turn_start"),
          Type.Literal("turn_end"),
        ]),
        context: Type.Optional(
          Type.Union([
            Type.Literal("tool_name"),
            Type.Literal("file_name"),
            Type.Literal("command"),
          ]),
        ),
        pattern: Type.Optional(Type.String()),
        command: Type.String(),
        cwd: Type.Optional(Type.String()),
        timeout: Type.Optional(Type.Number({ minimum: 0 })),
        notify: Type.Optional(Type.Boolean()),
      }),
    ),
  }),
);
const vc = (
  Value as { Check(this: void, schema: unknown, data: unknown): boolean }
).Check;
const ve = (
  Value as {
    Errors(
      this: void,
      schema: unknown,
      data: unknown,
    ): Iterable<{ path: string; message: string }>;
  }
).Errors;
export function validateConfig(data: unknown): HooksConfig {
  if (!vc(HooksConfigSchema, data)) {
    const errors = [...ve(HooksConfigSchema, data)];
    const messages = errors.map((e) => `${e.path}: ${e.message}`).join(", ");
    throw new Error(`Invalid hooks config: ${messages}`);
  }
  return data as HooksConfig;
}
export function isValidConfig(data: unknown): data is HooksConfig {
  return vc(HooksConfigSchema, data);
}
export function parseHookOutput(stdout: string): HookOutput | undefined {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("{")) return undefined;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    return parsed as HookOutput;
  } catch {
    return undefined;
  }
}
