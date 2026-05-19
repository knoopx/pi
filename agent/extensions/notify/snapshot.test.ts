import { describe, expect, it, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMockExtensionAPI } from "../../shared/testing/test-utils";
import type {
  MockExtensionAPI,
  MockTool,
} from "../../shared/testing/test-utils";
const mockCtx = {
  cwd: "/tmp",
  abort: () => {},
  hasUI: false,
};

describe("notify output snapshots", () => {
  let mockPi: MockExtensionAPI;
  let tool: MockTool;

  beforeEach(async () => {
    mockPi = createMockExtensionAPI();
    const { default: ext } = await import("./index");
    await ext(mockPi as ExtensionAPI);
    const calls = mockPi.registerTool.mock.calls as [MockTool][];
    const found = calls.find((c) => c[0]?.name === "notify");
    if (!found) throw new Error("notify tool not registered");
    tool = found[0];
  });

  it("renders success output", async () => {
    mockPi.exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    const result = await tool.execute(
      "id",
      { message: "Build complete — all tests passed" },
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
      { message: "Test" },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toBe(
      "Failed to send notification: Command not found",
    );
  });
});
