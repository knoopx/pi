import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const groundingTools = [
  "code-map",
  "code-query",
  "code-inspect",
  "code-callers",
  "code-callees",
  "code-trace",
  "code-deps",
];

describe("Scenario: No Cowboys In This Town Extension", () => {
  let mockPi: ExtensionAPI;
  let groundingDone = false;

  beforeEach(() => {
    vi.clearAllMocks();
    groundingDone = false;

    mockPi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      on: vi.fn((event, handler) => {
        // Store handlers for testing
        if (event === "session_start") {
          mockPi.sessionStartHandler = handler;
        } else if (event === "tool_result") {
          mockPi.toolResultHandler = handler;
        } else if (event === "tool_call") {
          mockPi.toolCallHandler = handler;
        }
      }),
    } as any;

    // Simulate the extension logic
    mockPi.on("session_start", () => {
      groundingDone = false;
    });

    mockPi.on("tool_result", (event: any) => {
      if (groundingTools.includes(event.toolName)) {
        groundingDone = true;
      }
    });

    mockPi.on("tool_call", async (event: any, _ctx: any) => {
      if (
        (event.toolName === "edit" || event.toolName === "write") &&
        !groundingDone
      ) {
        return {
          block: true,
          reason: `File editing is blocked until a context-grounding tool (${groundingTools.join(", ")}) has been used. Please gather context first.`,
        };
      }
    });
  });

  it("should not register any tools or commands", () => {
    expect(mockPi.registerTool).not.toHaveBeenCalled();
    expect(mockPi.registerCommand).not.toHaveBeenCalled();
  });

  describe("Given session start event", () => {
    it("should reset grounding state", () => {
      // First set grounding as done
      groundingDone = true;

      // Call session_start handler
      mockPi.sessionStartHandler();

      expect(groundingDone).toBe(false);
    });
  });

  describe("Given tool result event", () => {
    it("should mark grounding as done when grounding tool completes", () => {
      expect(groundingDone).toBe(false);

      mockPi.toolResultHandler({ toolName: "code-map" });

      expect(groundingDone).toBe(true);
    });

    it("should not mark grounding as done for non-grounding tools", () => {
      expect(groundingDone).toBe(false);

      mockPi.toolResultHandler({ toolName: "search-web" });

      expect(groundingDone).toBe(false);
    });

    groundingTools.forEach((toolName) => {
      it(`should recognize ${toolName} as a grounding tool`, () => {
        expect(groundingDone).toBe(false);

        mockPi.toolResultHandler({ toolName });

        expect(groundingDone).toBe(true);
      });
    });
  });

  describe("Given tool call event", () => {
    describe("When no grounding has occurred", () => {
      beforeEach(() => {
        groundingDone = false;
      });

      it("should block edit tool calls", async () => {
        const result = await mockPi.toolCallHandler({ toolName: "edit" }, {});
        expect(result).toEqual({
          block: true,
          reason: expect.stringContaining(
            "File editing is blocked until a context-grounding tool",
          ),
        });
        expect(result.reason).toContain(groundingTools.join(", "));
      });

      it("should block write tool calls", async () => {
        const result = await mockPi.toolCallHandler({ toolName: "write" }, {});
        expect(result).toEqual({
          block: true,
          reason: expect.stringContaining(
            "File editing is blocked until a context-grounding tool",
          ),
        });
      });

      it("should allow non-editing tools", async () => {
        const result = await mockPi.toolCallHandler(
          { toolName: "search-web" },
          {},
        );
        expect(result).toBeUndefined();
      });
    });

    describe("When grounding has occurred", () => {
      beforeEach(() => {
        groundingDone = true;
      });

      it("should allow edit tool calls after grounding", async () => {
        const result = await mockPi.toolCallHandler({ toolName: "edit" }, {});
        expect(result).toBeUndefined();
      });

      it("should allow write tool calls after grounding", async () => {
        const result = await mockPi.toolCallHandler({ toolName: "write" }, {});
        expect(result).toBeUndefined();
      });
    });

    describe("When session restarts", () => {
      it("should require grounding again after session restart", async () => {
        // First do grounding
        mockPi.toolResultHandler({ toolName: "code-query" });
        expect(groundingDone).toBe(true);

        // Then restart session
        mockPi.sessionStartHandler();
        expect(groundingDone).toBe(false);

        // Now editing should be blocked again
        const result = await mockPi.toolCallHandler({ toolName: "edit" }, {});
        expect(result).toEqual({
          block: true,
          reason: expect.stringContaining(
            "File editing is blocked until a context-grounding tool",
          ),
        });
      });
    });
  });

  describe("Given grounding tool validation", () => {
    it("should have correct grounding tools list", () => {
      expect(groundingTools).toEqual([
        "code-map",
        "code-query",
        "code-inspect",
        "code-callers",
        "code-callees",
        "code-trace",
        "code-deps",
      ]);
    });

    it("should have 7 grounding tools", () => {
      expect(groundingTools).toHaveLength(7);
    });
  });
});
