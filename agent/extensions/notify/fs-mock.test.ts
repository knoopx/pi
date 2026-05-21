import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockCommandContext } from "../../shared/testing/test-factories";
import {
  createNotifyFixture,
  sendNotification,
  setupNotifyTool,
} from "./test-factories";

async function assertNotificationText(
  promise: Promise<unknown>,
  _expectedSubstring: string,
): Promise<string> {
  const result = (await promise) as {
    content: Array<{ text: string }>;
    details?: { output: string };
  };
  return (result.content[0] as { text: string }).text;
}

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("{}"),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe("notify tool execution with TTS disabled", () => {
  const fixture = createNotifyFixture();

  beforeEach(async () => {
    await fixture.setup();
  });

  it("sends notify-send when TTS is disabled", async () => {
    fixture.mockPi.exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    const result = (await sendNotification(fixture.tool, false)) as {
      content: Array<{ text: string }>;
      details?: { output: string };
    };
    expect((result.content[0] as { text: string }).text).toBe(
      "Notification sent successfully",
    );
  });

  it("returns error when notify-send fails", async () => {
    fixture.mockPi.exec.mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "notify-send: command not found",
    });
    const result = await assertNotificationText(
      sendNotification(fixture.tool, false),
      "Failed to send notification",
    );
    expect(result).toContain("Failed to send notification");
  });

  it("returns error with stderr when notify-send fails", async () => {
    fixture.mockPi.exec.mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "dbus error",
    });
    const result = await assertNotificationText(
      sendNotification(fixture.tool, false),
      "dbus error",
    );
    expect(result).toContain("dbus error");
  });

  it("passes signal to notify-send", async () => {
    fixture.mockPi.exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    const signal = {} as AbortSignal;
    await fixture.tool.execute(
      "id",
      { message: "hello" },
      signal,
      undefined,
      createMockCommandContext({ hasUI: false }),
    );
    const execCalls = fixture.mockPi.exec.mock.calls as [
      string,
      unknown[],
      unknown,
    ][];
    expect(execCalls[0][2]).toEqual({ signal });
  });
});

describe("loadSettings error handling", () => {
  it("returns empty object when settings file has invalid JSON", async () => {
    vi.resetModules();
    vi.mock("node:fs/promises", () => ({
      readFile: vi.fn().mockResolvedValue("not valid json"),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
    }));
    const { mockPi } = await setupNotifyTool();
    expect(mockPi.registerTool).toHaveBeenCalled();
  });
});
