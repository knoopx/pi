import { describe, it, expect } from "vitest";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  containsAbortText,
  extractTextContent,
  isAbortedToolResult,
  isAbortedTurnEnd,
  isAbortedAgentEnd,
} from "./abort-detection";
import { buildHookInput } from "./pattern-matching";

const mockCtx = {
  cwd: "/test",
  hasUI: false,
} as unknown as ExtensionContext;

describe("buildHookInput", () => {
  describe("given tool_call event", () => {
    it("then includes tool_name and tool_input", () => {
      const input = buildHookInput("tool_call", mockCtx, {
        toolName: "write",
        input: { path: "test.ts", content: "test" },
        toolCallId: "call-123",
      });

      expect(input).toEqual({
        cwd: "/test",
        hook_event_name: "tool_call",
        tool_name: "write",
        tool_input: {
          path: "test.ts",
          content: "test",
        },
        tool_call_id: "call-123",
      });
    });
  });

  describe("given tool_result event", () => {
    it("then includes tool_response with content and isError", () => {
      const input = buildHookInput("tool_result", mockCtx, {
        toolName: "write",
        input: { path: "test.ts" },
        toolCallId: "call-123",
        toolResponse: {
          content: [{ text: "File written" }],
          details: { path: "test.ts" },
          isError: false,
        },
      });

      expect(input).toEqual({
        cwd: "/test",
        hook_event_name: "tool_result",
        tool_name: "write",
        tool_input: { path: "test.ts" },
        tool_call_id: "call-123",
        tool_response: {
          content: [{ text: "File written" }],
          details: { path: "test.ts" },
          isError: false,
        },
      });
    });
  });

  describe("given session_start event", () => {
    it("then includes only cwd and hook_event_name", () => {
      const input = buildHookInput("session_start", mockCtx, {});

      expect(input).toEqual({
        cwd: "/test",
        hook_event_name: "session_start",
      });
    });
  });
});

describe("containsAbortText", () => {
  describe("given text containing abort indicators", () => {
    it("then returns true for 'operation aborted'", () => {
      expect(containsAbortText("Operation aborted by user")).toBe(true);
    });

    it("then returns true for 'aborted'", () => {
      expect(containsAbortText("Process was aborted")).toBe(true);
    });

    it("then returns true for 'cancelled'", () => {
      expect(containsAbortText("Request cancelled")).toBe(true);
    });

    it("then returns true for 'canceled'", () => {
      expect(containsAbortText("Request canceled")).toBe(true);
    });

    it("then returns true for case insensitive", () => {
      expect(containsAbortText("ABORTED")).toBe(true);
      expect(containsAbortText("Aborted")).toBe(true);
    });
  });

  describe("given normal text", () => {
    it("then returns false", () => {
      expect(containsAbortText("File written successfully")).toBe(false);
      expect(containsAbortText("No errors found")).toBe(false);
    });
  });
});

describe("extractTextContent", () => {
  describe("given content array with text objects", () => {
    it("then extracts text from objects", () => {
      const content = [{ text: "First message" }, { text: "Second message" }];
      const result = extractTextContent(content);
      expect(result).toBe("First message\nSecond message");
    });

    it("then ignores non-text objects", () => {
      const content = [
        { text: "Valid text" },
        { type: "image", data: "base64..." },
        { text: "More text" },
      ];
      const result = extractTextContent(content);
      expect(result).toBe("Valid text\n\nMore text");
    });

    it("then handles string items directly", () => {
      const content = ["String one", "String two"];
      const result = extractTextContent(content);
      expect(result).toBe("String one\nString two");
    });

    it("then includes extraText if provided", () => {
      const content = [{ text: "From content" }];
      const result = extractTextContent(content, "Extra info");
      expect(result).toBe("From content\nExtra info");
    });
  });

  describe("given undefined content", () => {
    it("then returns empty string", () => {
      const result = extractTextContent(undefined);
      expect(result).toBe("");
    });

    it("then returns only extraText if content is undefined", () => {
      const result = extractTextContent(undefined, "Only extra");
      expect(result).toBe("Only extra");
    });
  });
});

describe("isAbortedToolResult", () => {
  describe("given non-error tool result", () => {
    it("then returns false", () => {
      const event = {
        isError: false,
        content: [{ text: "Success" }],
      };
      expect(isAbortedToolResult(event)).toBe(false);
    });
  });

  describe("given error tool result with abort text", () => {
    it("then returns true for 'aborted'", () => {
      const event = {
        isError: true,
        content: [{ text: "Operation was aborted by user" }],
      };
      expect(isAbortedToolResult(event)).toBe(true);
    });

    it("then returns true for 'cancelled'", () => {
      const event = {
        isError: true,
        content: [{ text: "Request cancelled" }],
      };
      expect(isAbortedToolResult(event)).toBe(true);
    });

    it("then returns true when abort text is in content", () => {
      const event = {
        isError: true,
        content: [{ text: "Aborted" }],
      };
      expect(isAbortedToolResult(event)).toBe(true);
    });
  });

  describe("given error tool result without abort text", () => {
    it("then returns false for regular errors", () => {
      const event = {
        isError: true,
        content: [{ text: "File not found" }],
      };
      expect(isAbortedToolResult(event)).toBe(false);
    });
  });
});

describe("isAbortedTurnEnd", () => {
  describe("given turn end with aborted assistant message", () => {
    it("then returns true when stopReason is 'aborted'", () => {
      const event = {
        message: {
          role: "assistant",
          stopReason: "aborted",
        },
      };
      expect(isAbortedTurnEnd(event)).toBe(true);
    });

    it("then returns true when errorMessage contains abort text", () => {
      const event = {
        message: {
          role: "assistant",
          errorMessage: "Operation aborted",
        },
      };
      expect(isAbortedTurnEnd(event)).toBe(true);
    });
  });

  describe("given turn end with non-aborted message", () => {
    it("then returns false for user role", () => {
      const event = {
        message: {
          role: "user",
          stopReason: "end_turn",
        },
      };
      expect(isAbortedTurnEnd(event)).toBe(false);
    });

    it("then returns false for normal assistant completion", () => {
      const event = {
        message: {
          role: "assistant",
          stopReason: "end_turn",
        },
      };
      expect(isAbortedTurnEnd(event)).toBe(false);
    });
  });

  describe("given undefined message", () => {
    it("then returns false", () => {
      const event = {};
      expect(isAbortedTurnEnd(event)).toBe(false);
    });
  });
});

describe("isAbortedAgentEnd", () => {
  describe("given agent end with aborted assistant message", () => {
    it("then returns true when last assistant message is aborted", () => {
      const event = {
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", stopReason: "aborted" },
        ],
      };
      expect(isAbortedAgentEnd(event)).toBe(true);
    });

    it("then returns true when errorMessage contains abort text", () => {
      const event = {
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", errorMessage: "Request cancelled" },
        ],
      };
      expect(isAbortedAgentEnd(event)).toBe(true);
    });
  });

  describe("given agent end with normal messages", () => {
    it("then returns false for completed assistant message", () => {
      const event = {
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", stopReason: "end_turn" },
        ],
      };
      expect(isAbortedAgentEnd(event)).toBe(false);
    });

    it("then returns false when last message is user", () => {
      const event = {
        messages: [{ role: "user", content: "Hello" }],
      };
      expect(isAbortedAgentEnd(event)).toBe(false);
    });
  });

  describe("given empty messages array", () => {
    it("then returns false", () => {
      const event = {
        messages: [],
      };
      expect(isAbortedAgentEnd(event)).toBe(false);
    });
  });
});
