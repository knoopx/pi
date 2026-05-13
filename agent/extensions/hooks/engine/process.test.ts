import { describe, it, expect } from "vitest";
import { shouldExecuteRule } from "./process";
import type { HookRule } from "../types/schema";

describe("shouldExecuteRule", () => {
  describe("given event mismatch", () => {
    it("then returns false", () => {
      const rule: HookRule = {
        event: "tool_result",
        command: "echo test",
      };
      expect(shouldExecuteRule(rule, "tool_call", "write", {})).toBe(false);
    });
  });

  describe("given matching event and no context", () => {
    it("then returns true", () => {
      const rule: HookRule = {
        event: "tool_result",
        command: "echo test",
      };
      expect(shouldExecuteRule(rule, "tool_result", "write", {})).toBe(true);
      expect(shouldExecuteRule(rule, "tool_result", "read", {})).toBe(true);
    });
  });

  describe("given file_name context with read-only tool", () => {
    const rule: HookRule = {
      event: "tool_result",
      command: 'bunx prettier --write "%file%"',
      context: "file_name",
      pattern: "*.md",
    };

    it("then returns false for read tool", () => {
      expect(
        shouldExecuteRule(rule, "tool_result", "read", { path: "docs.md" }),
      ).toBe(false);
    });

    it("then returns false for ls tool", () => {
      expect(
        shouldExecuteRule(rule, "tool_result", "ls", { path: "docs.md" }),
      ).toBe(false);
    });

    it("then returns false for find tool", () => {
      expect(
        shouldExecuteRule(rule, "tool_result", "find", { path: "docs.md" }),
      ).toBe(false);
    });

    it("then returns false for grep tool", () => {
      expect(
        shouldExecuteRule(rule, "tool_result", "grep", { path: "docs.md" }),
      ).toBe(false);
    });
  });

  describe("given file_name context with file-modifying tool", () => {
    const rule: HookRule = {
      event: "tool_result",
      command: 'bunx prettier --write "%file%"',
      context: "file_name",
      pattern: "*.md",
    };

    it("then returns true for write tool", () => {
      expect(
        shouldExecuteRule(rule, "tool_result", "write", { path: "docs.md" }),
      ).toBe(true);
    });

    it("then returns true for edit tool", () => {
      expect(
        shouldExecuteRule(rule, "tool_result", "edit", { path: "docs.md" }),
      ).toBe(true);
    });

    it("then returns true for bash tool", () => {
      expect(
        shouldExecuteRule(rule, "tool_result", "bash", { path: "docs.md" }),
      ).toBe(true);
    });
  });

  describe("given tool_name context with read-only tool", () => {
    const rule: HookRule = {
      event: "tool_result",
      command: "echo test",
      context: "tool_name",
      pattern: "write",
    };

    it("then does not skip (tool_name context is not file_name)", () => {
      expect(shouldExecuteRule(rule, "tool_result", "read", {})).toBe(false);
    });
  });

  describe("given command context with read-only tool", () => {
    const rule: HookRule = {
      event: "tool_call",
      command: "echo test",
      context: "command",
      pattern: "npm *",
    };

    it("then does not skip (command context is not file_name)", () => {
      expect(
        shouldExecuteRule(rule, "tool_call", "bash", {
          command: "npm install",
        }),
      ).toBe(true);
    });
  });
});
