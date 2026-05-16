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
  it("accepts text-only response", () => {
    expect(assessResponse("here's my thinking", [], [], known)).toEqual({
      ok: true,
    });
  });
  it("accepts text with tool calls", () => {
    const calls = [{ name: "read", input: { path: "/a" } }];
    expect(assessResponse("reading the file", calls, [], known)).toEqual({
      ok: true,
    });
  });
  it("accepts valid tool calls without text", () => {
    const calls = [{ name: "read", input: { path: "/a" } }];
    expect(assessResponse("", calls, [], known)).toEqual({ ok: true });
  });
  it("accepts multiple valid tool calls", () => {
    const calls = [
      { name: "read", input: { path: "/a" } },
      { name: "edit", input: { path: "/b" } },
    ];
    expect(assessResponse("", calls, [], known)).toEqual({ ok: true });
  });
  it("detects empty response (no text, no calls)", () => {
    expect(assessResponse("", [], [], known)).toEqual({
      ok: false,
      reason: "empty_response",
    });
  });
  it("detects empty response with whitespace-only text", () => {
    expect(assessResponse("   ", [], [], known)).toEqual({
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
  it("reports first unknown tool when multiple are present", () => {
    const result = assessResponse(
      "",
      [
        { name: "FakeA", input: {} },
        { name: "FakeB", input: {} },
      ],
      [],
      known,
    );
    expect(result).toEqual({ ok: false, reason: "unknown_tool:FakeA" });
  });
  it("skips hallucination check when registry empty", () => {
    expect(
      assessResponse("", [{ name: "Anything", input: {} }], [], new Set()),
    ).toEqual({ ok: true });
  });
  it("detects repeated tool call with no text", () => {
    const now = [{ name: "read", input: { path: "/a" } }];
    const prev = [{ name: "read", input: { path: "/a" } }];
    expect(assessResponse("", now, prev, known)).toEqual({
      ok: false,
      reason: "repeated_tool_call",
    });
  });
  it("detects repeated tool call with whitespace-only text", () => {
    const now = [{ name: "read", input: { path: "/a" } }];
    const prev = [{ name: "read", input: { path: "/a" } }];
    expect(assessResponse("   ", now, prev, known)).toEqual({
      ok: false,
      reason: "repeated_tool_call",
    });
  });
  it("does not flag as repeat when accompanied by explanatory text", () => {
    const now = [{ name: "bash", input: { command: "bun lint" } }];
    const prev = [{ name: "bash", input: { command: "bun lint" } }];
    expect(
      assessResponse("Let me re-run the linter to confirm.", now, prev, known),
    ).toEqual({ ok: true });
  });
  it("does not flag as repeat when inputs differ", () => {
    const now = [{ name: "read", input: { path: "/a" } }];
    const prev = [{ name: "read", input: { path: "/b" } }];
    expect(assessResponse("", now, prev, known)).toEqual({ ok: true });
  });
  it("does not flag as repeat when tool names differ", () => {
    const now = [{ name: "read", input: { path: "/a" } }];
    const prev = [{ name: "edit", input: { path: "/a" } }];
    expect(assessResponse("", now, prev, known)).toEqual({ ok: true });
  });
  it("does not flag as repeat when previous calls list is empty", () => {
    const now = [{ name: "read", input: { path: "/a" } }];
    expect(assessResponse("", now, [], known)).toEqual({ ok: true });
  });
  it("detects empty response even when previous calls exist", () => {
    const prev = [{ name: "read", input: { path: "/a" } }];
    expect(assessResponse("", [], prev, known)).toEqual({
      ok: false,
      reason: "empty_response",
    });
  });
  it("detects repeat against one of multiple previous calls", () => {
    const now = [{ name: "read", input: { path: "/a" } }];
    const prev = [
      { name: "edit", input: { path: "/b" } },
      { name: "read", input: { path: "/a" } },
    ];
    expect(assessResponse("", now, prev, known)).toEqual({
      ok: false,
      reason: "repeated_tool_call",
    });
  });
  it("detects repeat when one of multiple current calls repeats", () => {
    const now = [
      { name: "read", input: { path: "/new" } },
      { name: "bash", input: { command: "bun lint" } },
    ];
    const prev = [{ name: "bash", input: { command: "bun lint" } }];
    expect(assessResponse("", now, prev, known)).toEqual({
      ok: false,
      reason: "repeated_tool_call",
    });
  });
  it("prefers empty_tool_name over repeated_tool_call", () => {
    const now = [{ name: "", input: {} }];
    const prev = [{ name: "", input: {} }];
    expect(assessResponse("", now, prev, known)).toEqual({
      ok: false,
      reason: "empty_tool_name",
    });
  });
  it("prefers unknown_tool over repeated_tool_call", () => {
    const now = [{ name: "FakeTool", input: {} }];
    const prev = [{ name: "FakeTool", input: {} }];
    expect(assessResponse("", now, prev, known)).toEqual({
      ok: false,
      reason: "unknown_tool:FakeTool",
    });
  });
  it("detects malformed args sentinel", () => {
    const calls = [{ name: "read", input: { _raw: "garbage" } }];
    expect(assessResponse("", calls, [], known)).toEqual({
      ok: false,
      reason: "malformed_args:read",
    });
  });
  it("reports malformed args with ? for empty tool name", () => {
    const calls = [{ name: "", input: { _raw: "garbage" } }];
    expect(assessResponse("", calls, [], known)).toEqual({
      ok: false,
      reason: "empty_tool_name",
    });
  });
  it("does not flag _raw in nested objects", () => {
    const calls = [{ name: "read", input: { data: { _raw: "ok" } } }];
    expect(assessResponse("", calls, [], known)).toEqual({ ok: true });
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
    expect(buildCorrectionMessage("empty_response", tools)).toContain("empty");
  });
  it("generates empty-tool-name message with tool list", () => {
    const m = buildCorrectionMessage("empty_tool_name", tools);
    expect(m).toContain("empty name");
    expect(m).toContain("read");
  });
  it("generates empty-tool-name message with fallback when list empty", () => {
    const m = buildCorrectionMessage("empty_tool_name", new Set());
    expect(m).toContain("the available tools");
  });
  it("generates unknown-tool message with tool name", () => {
    const m = buildCorrectionMessage("unknown_tool:FakeTool", tools);
    expect(m).toContain("'FakeTool'");
    expect(m).toContain("does not exist");
    expect(m).toContain("read");
    expect(m).toContain("grep");
  });
  it("generates unknown-tool message with fallback when list empty", () => {
    const m = buildCorrectionMessage("unknown_tool:X", new Set());
    expect(m).toContain("the available tools");
  });
  it("generates malformed-args message", () => {
    const m = buildCorrectionMessage("malformed_args:read", tools);
    expect(m).toContain("'read'");
    expect(m).toContain("malformed");
    expect(m).toContain("JSON");
  });
  it("generates repeated-tool-call message", () => {
    const m = buildCorrectionMessage("repeated_tool_call", tools);
    expect(m).toContain("loop");
    expect(m).toContain("same tool call");
  });
  it("falls back to generic on unknown reason", () => {
    expect(buildCorrectionMessage("weird_thing", tools)).toContain(
      "weird_thing",
    );
  });
});

describe("turn_end handler", () => {
  let mockPi: MockExtensionAPI;
  let turnEndHandler: (event: unknown, ctx: ExtensionContext) => Promise<void>;
  let sessionStartHandler: (event: unknown) => Promise<void>;
  let toolExecHandler: (event: unknown) => Promise<void>;
  let mockCtx: ExtensionContext;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupExtension(mockPi as ExtensionAPI);

    const onCalls = (mockPi.on as ReturnType<typeof vi.fn>).mock
      .calls as any[][];
    turnEndHandler = onCalls.find((c) => c[0] === "turn_end")![1];
    sessionStartHandler = onCalls.find((c) => c[0] === "session_start")![1];
    toolExecHandler = onCalls.find((c) => c[0] === "tool_execution_start")![1];

    mockCtx = {
      cwd: "/test",
      hasUI: true,
      ui: {
        notify: vi.fn(),
        theme: {} as ExtensionUIContext["theme"],
      } as unknown as ExtensionUIContext,
    } as ExtensionContext;

    // Reset module-level state before each test
    void sessionStartHandler({});
  });

  async function setupFirstBashTurn() {
    await toolExecHandler({ toolName: "bash" });
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [
            {
              type: "toolCall",
              name: "bash",
              arguments: { command: "bun lint" },
            },
          ],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
    mockPi.sendUserMessage.mockReset();
  }

  async function sendEmptyResponseAndAssertCorrection() {
    await turnEndHandler(
      {
        message: { role: "assistant", stopReason: "end_turn", content: [] },
      },
      mockCtx,
    );
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("injecting correction"),
      "warning",
    );
    (mockCtx.ui.notify as ReturnType<typeof vi.fn>).mockReset();
  }

  it("returns early when message is missing", async () => {
    await turnEndHandler({}, mockCtx);
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });

  it("returns early when message is null", async () => {
    await turnEndHandler({ message: null }, mockCtx);
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
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

  it("does not skip non-assistant role with aborted stopReason", async () => {
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

    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("empty"),
      { deliverAs: "steer" },
    );
  });

  it("injects correction for empty response with end_turn", async () => {
    await turnEndHandler(
      {
        message: { role: "assistant", stopReason: "end_turn", content: [] },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("empty"),
      { deliverAs: "steer" },
    );
  });

  it("injects correction for empty response with stop_sequence", async () => {
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

  it("does not inject correction for valid tool call", async () => {
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

  it("handles mixed text + tool call content", async () => {
    await toolExecHandler({ toolName: "read" });

    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [
            { type: "text", text: "Let me read the file" },
            { type: "toolCall", name: "read", arguments: { path: "/a" } },
          ],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("handles null content", async () => {
    await turnEndHandler(
      {
        message: { role: "assistant", stopReason: "end_turn", content: null },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("empty"),
      { deliverAs: "steer" },
    );
  });

  it("handles undefined content", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: undefined,
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("empty"),
      { deliverAs: "steer" },
    );
  });

  it("handles text entry with missing text field", async () => {
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [{ type: "text" }],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("empty"),
      { deliverAs: "steer" },
    );
  });

  it("does not flag repeated call with explanatory text", async () => {
    await setupFirstBashTurn();
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [
            { type: "text", text: "Let me re-run the linter to confirm." },
            {
              type: "toolCall",
              name: "bash",
              arguments: { command: "bun lint" },
            },
          ],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("flags repeated call without text", async () => {
    await setupFirstBashTurn();
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [
            {
              type: "toolCall",
              name: "bash",
              arguments: { command: "bun lint" },
            },
          ],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("loop"),
      { deliverAs: "steer" },
    );
  });

  it("resets consecutive failures on success", async () => {
    await toolExecHandler({ toolName: "bash" });
    await sendEmptyResponseAndAssertCorrection();
    await turnEndHandler(
      {
        message: { role: "assistant", stopReason: "end_turn", content: [] },
      },
      mockCtx,
    );
    mockPi.sendUserMessage.mockReset();
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [{ type: "text", text: "I have an idea" }],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
    mockPi.sendUserMessage.mockReset();
    await turnEndHandler(
      {
        message: { role: "assistant", stopReason: "end_turn", content: [] },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalled();
  });

  it("suppresses corrections after MAX_CONSECUTIVE_CORRECTIONS", async () => {
    await sendEmptyResponseAndAssertCorrection();
    await sendEmptyResponseAndAssertCorrection();
    mockPi.sendUserMessage.mockReset();
    await turnEndHandler(
      {
        message: { role: "assistant", stopReason: "end_turn", content: [] },
      },
      mockCtx,
    );
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("suppressed"),
      "warning",
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("populates known tools from tool_execution_start", async () => {
    await toolExecHandler({ toolName: "read" });
    await toolExecHandler({ toolName: "edit" });

    // Unknown tool should be detected since registry is now populated
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [{ type: "toolCall", name: "FakeTool", arguments: {} }],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("FakeTool"),
      { deliverAs: "steer" },
    );
  });

  it("session_start resets state", async () => {
    // Build up state: previous calls + consecutive failures
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [
            { type: "toolCall", name: "bash", arguments: { command: "ls" } },
          ],
        },
      },
      mockCtx,
    );
    await turnEndHandler(
      {
        message: { role: "assistant", stopReason: "end_turn", content: [] },
      },
      mockCtx,
    );
    await sessionStartHandler({});

    mockPi.sendUserMessage.mockReset();
    (mockCtx.ui.notify as ReturnType<typeof vi.fn>).mockReset();
    await turnEndHandler(
      {
        message: {
          role: "assistant",
          stopReason: "end_turn",
          content: [
            { type: "toolCall", name: "bash", arguments: { command: "ls" } },
          ],
        },
      },
      mockCtx,
    );
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });
});
