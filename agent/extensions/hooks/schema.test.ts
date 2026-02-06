import { describe, it, expect } from "vitest";
import { validateConfig, isValidConfig } from "./schema";

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
