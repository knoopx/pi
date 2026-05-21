import { describe, it, expect, beforeEach } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { runHook } from "./execute";
import type { HookInput } from "../types/schema";
import { createMockExtensionAPI } from "../../../shared/testing/test-factories";
import type { MockExtensionAPI } from "../../../shared/testing/test-factories";

function makeHookOptions(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    rule: { event: "tool_call" as const, command: "echo hello", timeout: 5000 },
    group: { pattern: ".*", group: "test", hooks: [] },
    ctx: { hasUI: true, cwd: "/test/project" } as ExtensionContext,
    vars: { cwd: "/test/project" },
    hookInput: { tool_name: "bash" } as HookInput,
    ...overrides,
  };
}

describe("runHook", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
  });

  it("executes hook command and returns success result", async () => {
    mockPi.exec.mockResolvedValue({
      code: 0,
      stdout: '{"continue":true}',
      stderr: "",
    });
    const result = await runHook(
      mockPi as unknown as ExtensionAPI,
      makeHookOptions(),
    );

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{"continue":true}');
  });

  it("returns error result on execution failure", async () => {
    mockPi.exec.mockRejectedValue(new Error("command not found"));
    const result = await runHook(
      mockPi as unknown as ExtensionAPI,
      makeHookOptions({
        rule: {
          event: "tool_call" as const,
          command: "nonexistent",
          timeout: 5000,
        },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("command not found");
  });

  it("skips execution when command has unresolved variables", async () => {
    const result = await runHook(
      mockPi as unknown as ExtensionAPI,
      makeHookOptions({
        rule: {
          event: "tool_call" as const,
          command: "echo %VAR%",
          timeout: 5000,
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it("passes timeout to exec", async () => {
    mockPi.exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await runHook(
      mockPi as unknown as ExtensionAPI,
      makeHookOptions({
        rule: {
          event: "tool_call" as const,
          command: "echo hello",
          timeout: 10000,
        },
      }),
    );

    const execCalls = mockPi.exec.mock.calls as [
      string,
      unknown[],
      { timeout?: number; cwd?: string },
    ][];
    expect(execCalls[0][2].timeout).toBe(10000);
  });

  it("passes cwd to exec", async () => {
    mockPi.exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await runHook(
      mockPi as unknown as ExtensionAPI,
      makeHookOptions({
        ctx: { hasUI: true, cwd: "/test/project" } as ExtensionContext,
      }),
    );

    const execCalls = mockPi.exec.mock.calls as [
      string,
      unknown[],
      { timeout?: number; cwd?: string },
    ][];
    expect(execCalls[0][2].cwd).toBe("/test/project");
  });
});
