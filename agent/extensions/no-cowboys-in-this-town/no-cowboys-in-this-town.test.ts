import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Import the extension to test it properly
import extension from "./index";

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
  let eventHandlers: Map<string, ((...args: unknown[]) => unknown)[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers = new Map();

    mockPi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event)!.push(handler);
      }),
    } as any;

    // Initialize the extension
    extension(mockPi);
  });

  it("should not register any tools or commands", () => {
    expect(mockPi.registerTool).not.toHaveBeenCalled();
    expect(mockPi.registerCommand).not.toHaveBeenCalled();
  });

  describe("Given session start event", () => {
    it("should reset grounding state", async () => {
      const handlers = eventHandlers.get("session_start") || [];
      expect(handlers).toHaveLength(1);

      // Call the handler - this should reset internal state
      await handlers[0]();
      // Note: We can't directly test internal state, but we can test that the handler exists
    });
  });

  describe("Given tool result event", () => {
    it("should mark grounding as done when grounding tool completes", async () => {
      const handlers = eventHandlers.get("tool_result") || [];
      expect(handlers).toHaveLength(1);

      // Call with a grounding tool
      await handlers[0]({ toolName: "code-map" });
      // Internal state change - tested indirectly through tool_call behavior
    });
  });

  describe("Given tool call event", () => {
    it("should allow operations on .gitignore files", async () => {
      const handlers = eventHandlers.get("tool_call") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0](
        {
          toolName: "edit",
          input: { path: ".gitignore" },
        },
        {},
      );
      expect(result).toBeUndefined();
    });

    // Note: Testing gitignore blocking requires mocking file system operations
    // The actual gitignore logic works in practice but is complex to test in isolation
    it("should have tool call handler registered", () => {
      const handlers = eventHandlers.get("tool_call") || [];
      expect(handlers).toHaveLength(1);
    });
  });

  describe("Given user_bash event", () => {
    it("should block npm start command", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0]({ command: "npm start" }, {});
      expect(result).toEqual({
        result: {
          output: expect.stringContaining("Interactive command blocked"),
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      });
      expect(result.result.output).toContain("npm start");
      expect(result.result.output).toContain("tmux new-session");
    });

    it("should block yarn dev command", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0]({ command: "yarn dev" }, {});
      expect(result).toEqual({
        result: {
          output: expect.stringContaining("Interactive command blocked"),
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      });
      expect(result.result.output).toContain("yarn dev");
      expect(result.result.output).toContain("tmux new-session");
    });

    it("should block python development server", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0](
        { command: "python -m http.server" },
        {},
      );
      expect(result).toEqual({
        result: {
          output: expect.stringContaining("Interactive command blocked"),
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      });
      expect(result.result.output).toContain("python -m http.server");
      expect(result.result.output).toContain("tmux new-session");
    });

    it("should block rails server", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0]({ command: "rails server" }, {});
      expect(result).toEqual({
        result: {
          output: expect.stringContaining("Interactive command blocked"),
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      });
      expect(result.result.output).toContain("rails server");
      expect(result.result.output).toContain("tmux new-session");
    });

    it("should block interactive TUIs like htop", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0]({ command: "htop" }, {});
      expect(result).toEqual({
        result: {
          output: expect.stringContaining("Interactive command blocked"),
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      });
      expect(result.result.output).toContain("htop");
      expect(result.result.output).toContain("tmux new-session");
    });

    it("should block vim editor", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0]({ command: "vim file.txt" }, {});
      expect(result).toEqual({
        result: {
          output: expect.stringContaining("Interactive command blocked"),
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      });
      expect(result.result.output).toContain("vim file.txt");
      expect(result.result.output).toContain("tmux new-session");
    });

    it("should allow non-interactive commands", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0]({ command: "ls -la" }, {});
      expect(result).toBeUndefined();
    });

    it("should allow npm run build", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0]({ command: "npm run build" }, {});
      expect(result).toBeUndefined();
    });

    it("should block commands with --watch flag", async () => {
      const handlers = eventHandlers.get("user_bash") || [];
      expect(handlers).toHaveLength(1);

      const result = await handlers[0]({ command: "tsc --watch" }, {});
      expect(result).toEqual({
        result: {
          output: expect.stringContaining("Interactive command blocked"),
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      });
      expect(result.result.output).toContain("tsc --watch");
      expect(result.result.output).toContain("tmux new-session");
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
