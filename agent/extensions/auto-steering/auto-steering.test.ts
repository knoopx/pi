import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import { assessResponse, buildCorrectionMessage } from "./auto-steering";
import setupExtension from "./index";
import { createMockExtensionAPI } from "../../shared/testing/test-utils";
import type { MockExtensionAPI } from "../../shared/testing/test-utils";

const known = new Set(["read", "write", "edit", "bash", "ls", "find", "grep"]);

describe("assessResponse", () => {
  it("accepts text-only assistant response", () => {
    expect(assessResponse("here's my thinking", [], [], known)).toEqual({
      ok: true,
    });
  });
  it("accepts valid tool calls", () => {
    const calls = [{ name: "read", input: { path: "/a" } }];
    expect(assessResponse("", calls, [], known)).toEqual({ ok: true });
  });
  it("detects empty response (no text, no calls)", () => {
    expect(assessResponse("", [], [], known)).toEqual({
      ok: false,
      reason: "empty_response",
    });
  });
  it("detects empty tool name", () => {
    expect(assessResponse("", [{ name: "", input: {} }], [], known)).toEqual({
      ok: false,
      reason: "empty_tool_name",
    });
  });
  it("detects hallucinated tool name", () => {
    const result = assessResponse(
      "",
      [{ name: "FakeTool", input: {} }],
      [],
      known,
    );
    expect(result).toEqual({ ok: false, reason: "unknown_tool:FakeTool" });
  });
  it("skips hallucination check when registry empty", () => {
    expect(
      assessResponse("", [{ name: "Anything", input: {} }], [], new Set()),
    ).toEqual({ ok: true });
  });
  it("detects repeated tool call", () => {
    const now = [{ name: "read", input: { path: "/a" } }];
    const prev = [{ name: "read", input: { path: "/a" } }];
    expect(assessResponse("", now, prev, known)).toEqual({
      ok: false,
      reason: "repeated_tool_call",
    });
  });
  it("does not flag as repeat when inputs differ", () => {
    const now = [{ name: "read", input: { path: "/a" } }];
    const prev = [{ name: "read", input: { path: "/b" } }];
    expect(assessResponse("", now, prev, known)).toEqual({ ok: true });
  });
  it("detects malformed args sentinel", () => {
    const calls = [{ name: "read", input: { _raw: "garbage" } }];
    expect(assessResponse("", calls, [], known)).toEqual({
      ok: false,
      reason: "malformed_args:read",
    });
  });
});

describe("buildCorrectionMessage", () => {
  const tools = new Set([
    "read",
    "write",
    "edit",
    "bash",
    "ls",
    "find",
    "grep",
  ]);
  it("generates empty-response message", () => {
    const m = buildCorrectionMessage("empty_response", tools);
    expect(m).toContain("empty");
  });
  it("generates unknown-tool message with tool name", () => {
    const m = buildCorrectionMessage("unknown_tool:FakeTool", tools);
    expect(m).toContain("'FakeTool'");
    expect(m).toContain("does not exist");
    expect(m).toContain("read");
    expect(m).toContain("grep");
  });
  it("generates malformed-args message", () => {
    const m = buildCorrectionMessage("malformed_args:read", tools);
    expect(m).toContain("'read'");
    expect(m).toContain("malformed");
  });
  it("generates repeated-tool-call message", () => {
    const m = buildCorrectionMessage("repeated_tool_call", tools);
    expect(m).toContain("loop");
  });
  it("falls back to generic on unknown reason", () => {
    expect(buildCorrectionMessage("weird_thing", tools)).toContain(
      "weird_thing",
    );
  });
  it("uses dynamic tool list for empty_tool_name", () => {
    const m = buildCorrectionMessage(
      "empty_tool_name",
      new Set(["Foo", "Bar"]),
    );
    expect(m).toContain("[Foo, Bar]");
  });
  it("uses fallback text when tool list is empty", () => {
    const m = buildCorrectionMessage("empty_tool_name", new Set());
    expect(m).toContain("the available tools");
  });
});

describe("turn_end handler", () => {
  let mockPi: MockExtensionAPI;
  let turnEndHandler: (event: unknown, ctx: ExtensionContext) => Promise<void>;
  let mockCtx: ExtensionContext;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupExtension(mockPi as ExtensionAPI);

    // Extract the turn_end handler from the mock's on() calls
    const onCalls = (mockPi.on as ReturnType<typeof vi.fn>).mock
      .calls as any[][];
    const turnEndCall = onCalls.find((call) => call[0] === "turn_end")!;
    turnEndHandler = turnEndCall[1];

    mockCtx = {
      cwd: "/test",
      hasUI: true,
      ui: {
        notify: vi.fn(),
        theme: {} as ExtensionUIContext["theme"],
      } as unknown as ExtensionUIContext,
    } as ExtensionContext;
  });

  it("skips check when stopReason is 'aborted'", async () => {
    await turnEndHandler(
      { message: { role: "assistant", stopReason: "aborted", content: [] } },
      mockCtx,
    );

    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });

  it("skips check when stopReason is 'error'", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "error",
          errorMessage: "Connection error.",
          content: [],
        },
      },
      mockCtx,
    );

    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });

  it("injects correction for empty response with normal stopReason", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [],
        },
      },
      mockCtx,
    );

    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("empty"),
      { deliverAs: "steer" },
    );
  });

  it("injects correction for empty response with 'stop_sequence' stopReason", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "stop_sequence",
          content: [],
        },
      },
      mockCtx,
    );

    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("empty"),
      { deliverAs: "steer" },
    );
  });

  it("does not inject correction for valid text response", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [{ type: "text", text: "Here is my analysis" }],
        },
      },
      mockCtx,
    );

    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("does not inject correction for valid tool call response", async () => {
    // Register a known tool first
    const onCalls = (mockPi.on as ReturnType<typeof vi.fn>).mock
      .calls as any[][];
    const toolExecCall = onCalls.find(
      (call) => call[0] === "tool_execution_start",
    )!;
    const toolExecHandler = toolExecCall[1] as (
      event: unknown,
    ) => Promise<void>;
    await toolExecHandler({ toolName: "read" });

    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [
            { type: "toolCall", name: "read", arguments: { path: "/a" } },
          ],
        },
      },
      mockCtx,
    );

    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("does not skip check for non-assistant role with aborted stopReason", async () => {
    await turnEndHandler(
      {
        message: {
          role: "user",
          stopReason: "aborted",
          content: [],
        },
      },
      mockCtx,
    );

    // User messages with empty content still trigger the check
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("empty"),
      { deliverAs: "steer" },
    );
  });
});
