import { describe, it, expect } from "vitest";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  buildHookInput,
  containsAbortText,
  extractTextContent,
  isAbortedToolResult,
  isAbortedTurnEnd,
  isAbortedAgentEnd,
  getContextValue,
  getInputField,
  matchValuePattern,
} from "./index";

const mockCtx: ExtensionContext = {
  cwd: "/test",
  ui: {} as any,
  hasUI: false,
  sessionManager: {} as any,
  modelRegistry: {} as any,
  config: {} as any,
  extensions: [] as any,
  hooks: {} as any,
  guardrails: {} as any,
} as any;

describe("buildHookInput", () => {
  describe("given tool_call event", () => {
    it("then includes tool_name and tool_input", () => {
      const input = buildHookInput(
        "tool_call",
        mockCtx,
        "write",
        {
          path: "test.ts",
          content: "test",
        },
        "call-123",
      );

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
      const input = buildHookInput(
        "tool_result",
        mockCtx,
        "write",
        { path: "test.ts" },
        "call-123",
        {
          content: [{ text: "File written" }],
          details: { path: "test.ts" },
          isError: false,
        },
      );

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
      const input = buildHookInput("session_start", mockCtx);

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
      expect(isAbortedToolResult(event as any)).toBe(false);
    });
  });

  describe("given error tool result with abort text", () => {
    it("then returns true for 'aborted'", () => {
      const event = {
        isError: true,
        content: [{ text: "Operation was aborted by user" }],
      };
      expect(isAbortedToolResult(event as any)).toBe(true);
    });

    it("then returns true for 'cancelled'", () => {
      const event = {
        isError: true,
        content: [{ text: "Request cancelled" }],
      };
      expect(isAbortedToolResult(event as any)).toBe(true);
    });

    it("then returns true when abort text is in content", () => {
      const event = {
        isError: true,
        content: [{ text: "Aborted" }],
      };
      expect(isAbortedToolResult(event as any)).toBe(true);
    });
  });

  describe("given error tool result without abort text", () => {
    it("then returns false for regular errors", () => {
      const event = {
        isError: true,
        content: [{ text: "File not found" }],
      };
      expect(isAbortedToolResult(event as any)).toBe(false);
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
      expect(isAbortedTurnEnd(event as any)).toBe(true);
    });

    it("then returns true when errorMessage contains abort text", () => {
      const event = {
        message: {
          role: "assistant",
          errorMessage: "Operation aborted",
        },
      };
      expect(isAbortedTurnEnd(event as any)).toBe(true);
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
      expect(isAbortedTurnEnd(event as any)).toBe(false);
    });

    it("then returns false for normal assistant completion", () => {
      const event = {
        message: {
          role: "assistant",
          stopReason: "end_turn",
        },
      };
      expect(isAbortedTurnEnd(event as any)).toBe(false);
    });
  });

  describe("given undefined message", () => {
    it("then returns false", () => {
      const event = {};
      expect(isAbortedTurnEnd(event as any)).toBe(false);
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
      expect(isAbortedAgentEnd(event as any)).toBe(true);
    });

    it("then returns true when errorMessage contains abort text", () => {
      const event = {
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", errorMessage: "Request cancelled" },
        ],
      };
      expect(isAbortedAgentEnd(event as any)).toBe(true);
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
      expect(isAbortedAgentEnd(event as any)).toBe(false);
    });

    it("then returns false when last message is user", () => {
      const event = {
        messages: [{ role: "user", content: "Hello" }],
      };
      expect(isAbortedAgentEnd(event as any)).toBe(false);
    });
  });

  describe("given empty messages array", () => {
    it("then returns false", () => {
      const event = {
        messages: [],
      };
      expect(isAbortedAgentEnd(event as any)).toBe(false);
    });
  });
});

describe("getContextValue", () => {
  describe("given tool_name context", () => {
    it("then returns the tool name", () => {
      const result = getContextValue("tool_name", "write", {});
      expect(result).toBe("write");
    });

    it("then returns undefined when toolName is undefined", () => {
      const result = getContextValue("tool_name", undefined, {});
      expect(result).toBeUndefined();
    });
  });

  describe("given file_name context", () => {
    it("then returns the path from input", () => {
      const result = getContextValue("file_name", "write", { path: "test.ts" });
      expect(result).toBe("test.ts");
    });

    it("then returns undefined when path is not in input", () => {
      const result = getContextValue("file_name", "write", { content: "test" });
      expect(result).toBeUndefined();
    });

    it("then returns undefined when input is undefined", () => {
      const result = getContextValue("file_name", "write", undefined);
      expect(result).toBeUndefined();
    });
  });

  describe("given command context", () => {
    it("then returns command when tool is bash", () => {
      const result = getContextValue("command", "bash", { command: "ls -la" });
      expect(result).toBe("ls -la");
    });

    it("then returns undefined when tool is not bash", () => {
      const result = getContextValue("command", "write", {
        command: "npm install",
      });
      expect(result).toBeUndefined();
    });

    it("then returns undefined when command is not in input", () => {
      const result = getContextValue("command", "bash", { path: "/tmp" });
      expect(result).toBeUndefined();
    });
  });
});

describe("getInputField", () => {
  describe("given valid input object", () => {
    it("then returns the field value", () => {
      const result = getInputField(
        { path: "test.ts", content: "test" },
        "path",
      );
      expect(result).toBe("test.ts");
    });

    it("then converts non-string values to string", () => {
      const result = getInputField({ count: 42 }, "count");
      expect(result).toBe("42");
    });
  });

  describe("given missing field", () => {
    it("then returns undefined", () => {
      const result = getInputField({ path: "test.ts" }, "content");
      expect(result).toBeUndefined();
    });
  });

  describe("given null or undefined input", () => {
    it("then returns undefined for null", () => {
      const result = getInputField(null, "path");
      expect(result).toBeUndefined();
    });

    it("then returns undefined for undefined", () => {
      const result = getInputField(undefined, "path");
      expect(result).toBeUndefined();
    });
  });

  describe("given non-object input", () => {
    it("then returns undefined for string", () => {
      const result = getInputField("not an object", "path");
      expect(result).toBeUndefined();
    });

    it("then returns undefined for number", () => {
      const result = getInputField(123, "path");
      expect(result).toBeUndefined();
    });
  });
});

describe("matchValuePattern", () => {
  describe("given glob pattern for file extensions", () => {
    it("then matches *.ts for TypeScript files", () => {
      expect(matchValuePattern("test.ts", "*.ts")).toBe(true);
      expect(matchValuePattern("src/index.ts", "*.ts")).toBe(true);
    });

    it("then matches *.{ts,tsx} for TypeScript and TSX", () => {
      expect(matchValuePattern("test.ts", "*.{ts,tsx}")).toBe(true);
      expect(matchValuePattern("test.tsx", "*.{ts,tsx}")).toBe(true);
      expect(matchValuePattern("test.js", "*.{ts,tsx}")).toBe(false);
    });

    it("then matches basename for paths", () => {
      expect(matchValuePattern("/home/user/test.ts", "*.ts")).toBe(true);
      expect(matchValuePattern("src/utils.ts", "*.ts")).toBe(true);
    });
  });

  describe("given alternation pattern", () => {
    it("then matches any alternative", () => {
      expect(matchValuePattern("write", "{write,edit}")).toBe(true);
      expect(matchValuePattern("edit", "{write,edit}")).toBe(true);
      expect(matchValuePattern("read", "{write,edit}")).toBe(false);
    });
  });

  describe("given exact string pattern", () => {
    it("then matches exact tool names", () => {
      expect(matchValuePattern("write", "write")).toBe(true);
      expect(matchValuePattern("edit", "write")).toBe(false);
    });
  });

  describe("given wildcard pattern", () => {
    it("then matches any file", () => {
      expect(matchValuePattern("test.js", "*"));
      expect(matchValuePattern("test.ts", "*"));
    });
  });

  describe("given invalid pattern", () => {
    it("then returns false gracefully", () => {
      expect(matchValuePattern("test", "[invalid")).toBe(false);
    });
  });
});
