/**
 * Snapshot tests for Notification tool output formatting.
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createMockExtensionAPI } from "../../shared/test-utils";
import type { MockExtensionAPI, MockTool } from "../../shared/test-utils";

const mockCtx = {
  cwd: "/tmp",
  abort: () => {},
  hasUI: false,
};

describe("notification output snapshots", () => {
  let mockPi: MockExtensionAPI;
  let tool: MockTool;

  beforeEach(async () => {
    mockPi = createMockExtensionAPI();
    const { default: ext } = await import("./index");
    ext(mockPi as ExtensionAPI);
    const calls = mockPi.registerTool.mock.calls as unknown as Array<
      { name: string } & MockTool
    >;
    const found = calls.find((c) => c.name === "notify");
    expect(found).toBeDefined();
    tool = found as MockTool;
  });

  it("renders success output", async () => {
    mockPi.exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

    const result = await tool.execute(
      "id",
      { summary: "Build complete", body: "All tests passed" },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toBe(
      "Notification sent successfully",
    );
  });

  it("renders failure output", async () => {
    mockPi.exec.mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "Command not found",
    });

    const result = await tool.execute(
      "id",
      { summary: "Test" },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toBe(
      "Failed to send notification: Command not found",
    );
  });
});
