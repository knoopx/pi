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

  it("renders success output with TTS enabled", async () => {
    const result = await tool.execute(
      "id",
      { message: "Build complete — all tests passed" },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toBe(
      "Notification sent via TTS",
    );
    // verify notify-send was not called (only tts via sh)
    const calls = mockPi.exec.mock.calls as [string, unknown[], unknown][];
    expect(calls.some(([cmd]) => cmd === "notify-send")).toBe(false);
  });

  it("skips notify-send when TTS enabled", async () => {
    const result = await tool.execute(
      "id",
      { message: "Test" },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toBe(
      "Notification sent via TTS",
    );
    // verify notify-send was not called
    const calls = mockPi.exec.mock.calls as [string, unknown[], unknown][];
    expect(calls.some(([cmd]) => cmd === "notify-send")).toBe(false);
  });
});
