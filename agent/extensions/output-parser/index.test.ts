import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import setupExtension from "./index";
import {
  createExtensionFixture,
  createMockExtensionAPI,
  createMockExtensionContext,
  expectEarlyReturnOnNullMessage,
  expectNoToolFollowUp,
  type MockExtensionAPI,
} from "../../shared/testing/test-factories";

describe("extension registration", () => {
  it("registers turn_end handler", () => {
    const mockPi = createMockExtensionAPI();
    setupExtension(mockPi as ExtensionAPI);

    const onCalls = (mockPi.on as ReturnType<typeof vi.fn>).mock
      .calls as unknown[][];
    const turnEndHandler = onCalls.find((c) => c[0] === "turn_end");
    expect(turnEndHandler).toBeDefined();
    expect(typeof turnEndHandler![1]).toBe("function");
  });
});

describe("handleTurnEnd", () => {
  const fixture = createExtensionFixture(setupExtension);
  let mockPi: MockExtensionAPI = createMockExtensionAPI();
  let turnEndHandler: (
    event: unknown,
    ctx: ExtensionContext,
  ) => unknown = async () => {};
  let mockCtx: ExtensionContext = createMockExtensionContext();

  beforeEach(() => {
    fixture.setup();
    mockPi = fixture.mockPi;
    turnEndHandler = fixture.getHandler("turn_end");
    mockCtx = fixture.mockCtx;
  });

  it("returns early when message has native tool calls", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content: [
            { type: "toolCall", name: "read", arguments: { path: "/a" } },
          ],
        },
      },
      mockCtx,
    );
    expectNoToolFollowUp(mockPi, mockCtx);
  });

  expectEarlyReturnOnNullMessage(turnEndHandler, mockPi, mockCtx);

  it("returns early when message has no content", async () => {
    await turnEndHandler({ message: {} }, mockCtx);
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("returns early when text is empty", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content: "",
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("returns early when no tool calls found in text", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content: "just regular text, no tools here",
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("sends followUp when fenced tool block detected", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content:
            'thinking\n```tool\n{"name":"read","input":{"file_path":"/x.py"}}\n```',
        },
      },
      mockCtx,
    );
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("Detected 1 text-embedded tool call"),
      "warning",
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("NATIVE tool calls"),
      { deliverAs: "followUp" },
    );
  });

  it("sends followUp when multiple tool calls detected", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content:
            '```tool\n{"name":"read","input":{"file_path":"/a"}}\n```\n```tool\n{"name":"bash","input":{"command":"ls"}}\n```',
        },
      },
      mockCtx,
    );
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("Detected 2 text-embedded tool call"),
      "warning",
    );
  });

  it("sends followUp when bare JSON detected", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content: 'the model said: {"name":"glob","pattern":"**/*.py"}',
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("glob"),
      { deliverAs: "followUp" },
    );
  });

  it("handles array content with text blocks", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "thinking" },
            {
              type: "text",
              text: '```tool\n{"name":"read","input":{"file_path":"/a"}}\n```',
            },
          ],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("read"),
      { deliverAs: "followUp" },
    );
  });

  it("handles mixed text and toolCall content (native calls present -> skip)", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "thinking" },
            { type: "toolCall", name: "read", arguments: { path: "/a" } },
          ],
        },
      },
      mockCtx,
    );
    // Native tool calls present -> extractMessage returns null
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("returns early when content is not string or array", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content: 42 as unknown as string | Array<unknown>,
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("includes call details in followUp message", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          content:
            '```tool\n{"name":"edit","input":{"path":"/a","oldText":"x"}}\n```',
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("edit"),
      { deliverAs: "followUp" },
    );
  });
});
