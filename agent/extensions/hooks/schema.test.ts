import { describe, it, expect } from "vitest";
import { validateConfig, isValidConfig, parseHookOutput } from "./schema";

describe("validateConfig", () => {
  it("accepts valid config", () => {
    const config = [
      {
        group: "typescript",
        pattern: "tsconfig.json",
        hooks: [
          {
            event: "tool_result",
            command: "tsc --noEmit",
          },
        ],
      },
    ];
    expect(() => validateConfig(config)).not.toThrow();
    expect(validateConfig(config)).toEqual(config);
  });

  it("accepts config with all optional fields", () => {
    const config = [
      {
        group: "full",
        pattern: "*",
        hooks: [
          {
            event: "tool_result",
            context: "file_name",
            pattern: "\\.ts$",
            command: "prettier ${file}",
            cwd: "/tmp",
            timeout: 5000,
            notify: false,
          },
        ],
      },
    ];
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("accepts empty config array", () => {
    expect(() => validateConfig([])).not.toThrow();
    expect(validateConfig([])).toEqual([]);
  });

  it("rejects non-array config", () => {
    expect(() => validateConfig({})).toThrow("Invalid hooks config");
    expect(() => validateConfig(null)).toThrow("Invalid hooks config");
    expect(() => validateConfig("string")).toThrow("Invalid hooks config");
  });

  it("rejects missing required group fields", () => {
    expect(() => validateConfig([{ pattern: "*", hooks: [] }])).toThrow();
    expect(() => validateConfig([{ group: "test", hooks: [] }])).toThrow();
    expect(() => validateConfig([{ group: "test", pattern: "*" }])).toThrow();
  });

  it("rejects missing required hook fields", () => {
    const config = [
      {
        group: "test",
        pattern: "*",
        hooks: [{ command: "echo test" }],
      },
    ];
    expect(() => validateConfig(config)).toThrow();
  });

  it("rejects invalid event type", () => {
    const config = [
      {
        group: "test",
        pattern: "*",
        hooks: [{ event: "invalid_event", command: "echo test" }],
      },
    ];
    expect(() => validateConfig(config)).toThrow();
  });

  it("rejects invalid context type", () => {
    const config = [
      {
        group: "test",
        pattern: "*",
        hooks: [
          { event: "tool_result", context: "invalid_context", command: "echo" },
        ],
      },
    ];
    expect(() => validateConfig(config)).toThrow();
  });

  it("rejects invalid timeout type", () => {
    const config = [
      {
        group: "test",
        pattern: "*",
        hooks: [{ event: "tool_result", command: "echo", timeout: "5000" }],
      },
    ];
    expect(() => validateConfig(config)).toThrow();
  });

  it("rejects negative timeout", () => {
    const config = [
      {
        group: "test",
        pattern: "*",
        hooks: [{ event: "tool_result", command: "echo", timeout: -1 }],
      },
    ];
    expect(() => validateConfig(config)).toThrow();
  });
});

describe("isValidConfig", () => {
  it("returns true for valid config", () => {
    expect(
      isValidConfig([
        {
          group: "test",
          pattern: "*",
          hooks: [{ event: "agent_end", command: "echo done" }],
        },
      ]),
    ).toBe(true);
  });

  it("returns false for invalid config", () => {
    expect(isValidConfig(null)).toBe(false);
    expect(isValidConfig({})).toBe(false);
    expect(isValidConfig([{ invalid: true }])).toBe(false);
  });

  it("validates all event types", () => {
    const events = [
      "session_start",
      "session_shutdown",
      "tool_call",
      "tool_result",
      "agent_start",
      "agent_end",
      "turn_start",
      "turn_end",
    ];

    for (const event of events) {
      const config = [
        { group: "test", pattern: "*", hooks: [{ event, command: "echo" }] },
      ];
      expect(isValidConfig(config)).toBe(true);
    }
  });

  it("validates all context types", () => {
    const contexts = ["tool_name", "file_name", "command"];

    for (const context of contexts) {
      const config = [
        {
          group: "test",
          pattern: "*",
          hooks: [{ event: "tool_result", context, command: "echo" }],
        },
      ];
      expect(isValidConfig(config)).toBe(true);
    }
  });
});

describe("parseHookOutput", () => {
  it("parses valid JSON output", () => {
    const output = parseHookOutput('{"decision": "block", "reason": "test"}');
    expect(output).toEqual({ decision: "block", reason: "test" });
  });

  it("parses JSON with continue field", () => {
    const output = parseHookOutput(
      '{"continue": false, "stopReason": "Build failed"}',
    );
    expect(output).toEqual({ continue: false, stopReason: "Build failed" });
  });

  it("parses hookSpecificOutput for PreToolUse", () => {
    const output = parseHookOutput(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "tool_call",
          permissionDecision: "deny",
          permissionDecisionReason: "Blocked by policy",
        },
      }),
    );
    expect(output?.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(output?.hookSpecificOutput?.permissionDecisionReason).toBe(
      "Blocked by policy",
    );
  });

  it("parses additionalContext", () => {
    const output = parseHookOutput(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "session_start",
          additionalContext: "Extra context for Claude",
        },
      }),
    );
    expect(output?.hookSpecificOutput?.additionalContext).toBe(
      "Extra context for Claude",
    );
  });

  it("returns undefined for non-JSON output", () => {
    expect(parseHookOutput("plain text")).toBeUndefined();
    expect(parseHookOutput("not json at all")).toBeUndefined();
    expect(parseHookOutput("Error: something failed")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseHookOutput("")).toBeUndefined();
    expect(parseHookOutput("   ")).toBeUndefined();
  });

  it("returns undefined for invalid JSON", () => {
    expect(parseHookOutput("{invalid json}")).toBeUndefined();
    expect(parseHookOutput('{"unclosed": ')).toBeUndefined();
  });

  it("returns undefined for non-object JSON", () => {
    expect(parseHookOutput("[]")).toBeUndefined();
    expect(parseHookOutput('"string"')).toBeUndefined();
    expect(parseHookOutput("123")).toBeUndefined();
    expect(parseHookOutput("null")).toBeUndefined();
  });

  it("handles JSON with whitespace", () => {
    const output = parseHookOutput('  \n  {"decision": "block"}  \n  ');
    expect(output).toEqual({ decision: "block" });
  });

  it("parses suppressOutput field", () => {
    const output = parseHookOutput('{"suppressOutput": true}');
    expect(output?.suppressOutput).toBe(true);
  });

  it("parses systemMessage field", () => {
    const output = parseHookOutput('{"systemMessage": "Warning: check this"}');
    expect(output?.systemMessage).toBe("Warning: check this");
  });
});
