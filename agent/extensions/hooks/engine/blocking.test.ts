import { describe, it, expect } from "vitest";
import { shouldBlock } from "./blocking";
import type { HookResult } from "../types/results";

function makeResult(overrides: Partial<HookResult> = {}): HookResult {
  return {
    success: true,
    exitCode: 0,
    stdout: "",
    stderr: "",
    output: undefined,
    group: "test",
    command: "echo hello",
    ...overrides,
  };
}

describe("shouldBlock", () => {
  describe("exit code blocking", () => {
    it("blocks on exit code 2", () => {
      const result = shouldBlock(makeResult({ exitCode: 2 }), "tool_call");
      expect(result.block).toBe(true);
    });

    it("uses stderr as reason on exit code 2", () => {
      const result = shouldBlock(
        makeResult({
          exitCode: 2,
          stderr: "permission denied",
        }),
        "tool_call",
      );
      expect(result.reason).toContain("permission denied");
    });

    it("does not block on exit code 0", () => {
      const result = shouldBlock(makeResult({ exitCode: 0 }), "tool_call");
      expect(result.block).toBe(false);
    });

    it("does not block on exit code 1", () => {
      const result = shouldBlock(makeResult({ exitCode: 1 }), "tool_call");
      expect(result.block).toBe(false);
    });
  });

  describe("JSON output blocking", () => {
    it("blocks when continue is false", () => {
      const result = shouldBlock(
        makeResult({
          success: true,
          output: { continue: false, stopReason: "manual stop" },
        }),
        "tool_call",
      );
      expect(result.block).toBe(true);
      expect(result.reason).toContain("manual stop");
    });

    it("does not block when continue is true", () => {
      const result = shouldBlock(
        makeResult({
          success: true,
          output: { continue: true },
        }),
        "tool_call",
      );
      expect(result.block).toBe(false);
    });

    it("blocks when decision is block", () => {
      const result = shouldBlock(
        makeResult({
          success: true,
          output: { decision: "block", reason: "unsafe command" },
        }),
        "tool_call",
      );
      expect(result.block).toBe(true);
      expect(result.reason).toBe("unsafe command");
    });

    it("does not block when decision is allow", () => {
      const result = shouldBlock(
        makeResult({
          success: true,
          output: {},
        }),
        "tool_call",
      );
      expect(result.block).toBe(false);
    });

    it("blocks on permission deny for tool_call", () => {
      const result = shouldBlock(
        makeResult({
          success: true,
          output: {
            hookSpecificOutput: {
              hookEventName: "tool_call",
              permissionDecision: "deny",
              permissionDecisionReason: "not allowed",
            },
          },
        }),
        "tool_call",
      );
      expect(result.block).toBe(true);
      expect(result.reason).toBe("not allowed");
    });

    it("does not block on permission allow", () => {
      const result = shouldBlock(
        makeResult({
          success: true,
          output: {
            hookSpecificOutput: {
              hookEventName: "tool_call",
              permissionDecision: "allow",
            },
          },
        }),
        "tool_call",
      );
      expect(result.block).toBe(false);
    });
  });

  describe("error blocking", () => {
    it("blocks on error for tool_call event with blocking tool", () => {
      const result = shouldBlock(
        makeResult({
          success: false,
          exitCode: 1,
          stderr: "command failed",
        }),
        "tool_call",
        "bash",
      );
      expect(result.block).toBe(true);
    });

    it("does not block on error for non-blocking tool", () => {
      const result = shouldBlock(
        makeResult({
          success: false,
          exitCode: 1,
        }),
        "tool_call",
        "edit",
      );
      expect(result.block).toBe(false);
    });

    it("does not block on error for non-blocking event", () => {
      const result = shouldBlock(
        makeResult({
          success: false,
          exitCode: 1,
        }),
        "turn_end",
        "bash",
      );
      expect(result.block).toBe(false);
    });

    it("blocks on error for agent_end event", () => {
      const result = shouldBlock(
        makeResult({
          success: false,
          exitCode: 1,
        }),
        "agent_end",
        "bash",
      );
      expect(result.block).toBe(true);
    });

    it("uses stdout as fallback error reason", () => {
      const result = shouldBlock(
        makeResult({
          success: false,
          exitCode: 1,
          stdout: "some output",
        }),
        "tool_call",
        "bash",
      );
      expect(result.reason).toContain("some output");
    });

    it("uses 'Hook failed' when no stdout/stderr", () => {
      const result = shouldBlock(
        makeResult({
          success: false,
          exitCode: 1,
          stdout: "",
          stderr: "",
        }),
        "tool_call",
        "bash",
      );
      expect(result.reason).toContain("Hook failed");
    });

    it("does not block on success", () => {
      const result = shouldBlock(makeResult({ success: true }), "tool_call");
      expect(result.block).toBe(false);
    });
  });

  describe("no blocking", () => {
    it("returns no block when all checks pass", () => {
      const result = shouldBlock(makeResult({ success: true }), "tool_call");
      expect(result).toEqual({ block: false, reason: "" });
    });
  });
});
