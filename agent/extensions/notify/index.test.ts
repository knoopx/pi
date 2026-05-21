import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
  createMockCommandContext,
  createMockExtensionAPI,
} from "../../shared/testing/test-factories";
import type {
  MockExtensionAPI,
  MockTool,
} from "../../shared/testing/test-factories";
import { createNotifyFixture, setupNotifyTool } from "./test-factories";

// Default: TTS enabled via settings mock
const ttsSettings = '{"notification":{"tts":true}}';
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(ttsSettings),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

function getTtsHandler(mockPi: MockExtensionAPI) {
  const calls = mockPi.registerCommand.mock.calls as [string, unknown][];
  const ttsEntry = calls.find((c) => c[0] === "tts");
  return (
    ttsEntry![1] as {
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
    }
  ).handler;
}

function createTtsContext(hasUI = true): ExtensionCommandContext & {
  ui: { notify: ReturnType<typeof vi.fn>; theme: unknown };
} {
  const ctx = createMockCommandContext({ hasUI });
  if (hasUI) {
    ctx.ui = {
      notify: vi.fn(),
      theme: {},
    } as unknown as ExtensionCommandContext["ui"];
  }
  return ctx as ExtensionCommandContext & {
    ui: { notify: ReturnType<typeof vi.fn>; theme: unknown };
  };
}

describe("extension registration", () => {
  it("registers notify tool and tts command", async () => {
    const mockPi = createMockExtensionAPI();
    const { default: ext } = await import("./index");
    await ext(mockPi as ExtensionAPI);

    const toolCalls = mockPi.registerTool.mock.calls as [MockTool][];
    const ttsCalls = mockPi.registerCommand.mock.calls as [string, unknown][];

    expect(toolCalls.some((c) => c[0]?.name === "notify")).toBe(true);
    expect(ttsCalls.some((c) => c[0] === "tts")).toBe(true);
  });
});

describe("notify tool execution with TTS enabled", () => {
  const fixture = createNotifyFixture();

  beforeEach(async () => {
    await fixture.setup();
  });

  it("sends TTS notification", async () => {
    const result = await fixture.tool.execute(
      "id",
      { message: "hello" },
      undefined,
      undefined,
      createMockCommandContext({ hasUI: false }),
    );
    expect((result.content[0] as { text: string }).text).toBe(
      "Notification sent via TTS",
    );
  });

  it("does not call notify-send when TTS is enabled", async () => {
    await fixture.tool.execute(
      "id",
      { message: "hello" },
      undefined,
      undefined,
      createMockCommandContext({ hasUI: false }),
    );
    const execCalls = fixture.mockPi.exec.mock.calls as [
      string,
      unknown[],
      unknown,
    ][];
    expect(execCalls.some(([cmd]) => cmd === "notify-send")).toBe(false);
  });
});

describe("tts command handler", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(async () => {
    vi.resetModules();
    mockPi = createMockExtensionAPI();
    const { default: ext } = await import("./index");
    await ext(mockPi as ExtensionAPI);
  });

  it("calls handler with on action", async () => {
    const handler = getTtsHandler(mockPi);
    const ctx = createTtsContext();
    await handler("on", ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "TTS enabled for notifications",
      "info",
    );
  });

  it("calls handler with off action", async () => {
    const handler = getTtsHandler(mockPi);
    const ctx = createTtsContext();
    await handler("off", ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "TTS disabled for notifications",
      "info",
    );
  });

  it("calls handler with toggle (no args)", async () => {
    const handler = getTtsHandler(mockPi);
    const ctx = createTtsContext();
    await handler("", ctx);
    // Toggle off (since extension starts with TTS enabled)
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "TTS disabled for notifications",
      "info",
    );
  });

  it("does not call ui.notify when hasUI is false", async () => {
    const handler = getTtsHandler(mockPi);
    const ctx = createTtsContext(false);
    await handler("on", ctx);
    // Should not crash, just skip UI notify
  });

  it("returns status message for unknown action", async () => {
    const handler = getTtsHandler(mockPi);
    const ctx = createTtsContext();
    await handler("invalid", ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("TTS is"),
      "info",
    );
  });
});

// Test empty message (runTts early return path)
describe("empty message handling", () => {
  it("skips TTS exec for empty message", async () => {
    const { mockPi, tool } = await setupNotifyTool();

    const result = await tool.execute(
      "id",
      { message: "   " },
      undefined,
      undefined,
      createMockCommandContext({ hasUI: false }),
    );
    expect((result.content[0] as { text: string }).text).toBe(
      "Notification sent via TTS",
    );
    // TTS exec should not be called for empty/whitespace message
    const shCalls = mockPi.exec.mock.calls as [string, unknown[], unknown][];
    expect(shCalls.some(([cmd]) => cmd === "sh")).toBe(false);
  });
});
