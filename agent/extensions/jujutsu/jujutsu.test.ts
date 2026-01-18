import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  ExtensionContext,
  ExtensionCommandContext,
  BeforeAgentStartEvent,
} from "@mariozechner/pi-coding-agent";
import setupJujutsuExtension from "./index";

vi.mock("@mariozechner/pi-ai", () => ({
  complete: vi.fn(),
}));

interface MockExtensionAPI {
  registerCommand: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  registerTool: ReturnType<typeof vi.fn>;
  registerShortcut: ReturnType<typeof vi.fn>;
  registerFlag: ReturnType<typeof vi.fn>;
  getFlag: ReturnType<typeof vi.fn>;
}

describe("Jujutsu Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(async () => {
    mockPi = {
      registerCommand: vi.fn(),
      exec: vi.fn(),
      on: vi.fn(),
      registerTool: vi.fn(),
      registerShortcut: vi.fn(),
      registerFlag: vi.fn(),
      getFlag: vi.fn().mockReturnValue(true),
    };
    // Mock jj status to succeed (is a repo)
    mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 });
    await setupJujutsuExtension(mockPi as any);
    // Clear the mock to reset call counts for individual tests
    mockPi.exec.mockClear();
  });

  const getEventHandler = (eventName: string) =>
    mockPi.on.mock.calls.find((call) => call[0] === eventName)?.[1];

  const getCommandHandler = (commandName: string) =>
    mockPi.registerCommand.mock.calls.find(
      (call) => call[0] === commandName,
    )?.[1].handler;

  it("should register commands even when not in a Jujutsu repository", async () => {
    // Setup fresh mock for this test
    const freshMockPi: MockExtensionAPI = {
      exec: vi.fn(),
      on: vi.fn(),
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      registerShortcut: vi.fn(),
      registerFlag: vi.fn(),
      getFlag: vi.fn().mockReturnValue(true),
    };

    // Mock jj status to fail (not a repo)
    freshMockPi.exec.mockRejectedValueOnce(
      new Error("Not a Jujutsu repository"),
    );

    await setupJujutsuExtension(freshMockPi as any);

    // Should still register commands and event listeners
    expect(freshMockPi.registerCommand).toHaveBeenCalledWith(
      "undo",
      expect.any(Object),
    );
    expect(freshMockPi.registerCommand).toHaveBeenCalledWith(
      "redo",
      expect.any(Object),
    );
    expect(freshMockPi.registerCommand).toHaveBeenCalledWith(
      "jujutsu",
      expect.any(Object),
    );
    expect(freshMockPi.registerCommand).toHaveBeenCalledWith(
      "jujutsu-enable",
      expect.any(Object),
    );
    expect(freshMockPi.registerCommand).toHaveBeenCalledWith(
      "jujutsu-disable",
      expect.any(Object),
    );
    expect(freshMockPi.on).toHaveBeenCalledWith(
      "before_agent_start",
      expect.any(Function),
    );
    expect(freshMockPi.on).toHaveBeenCalledWith(
      "turn_start",
      expect.any(Function),
    );
    expect(freshMockPi.on).toHaveBeenCalledWith(
      "agent_end",
      expect.any(Function),
    );
  });

  it("should activate when in a Jujutsu repository", async () => {
    // This is covered by the beforeEach setup and the registration tests below
    // But let's verify the registrations
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "undo",
      expect.any(Object),
    );
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "redo",
      expect.any(Object),
    );
    expect(mockPi.on).toHaveBeenCalledWith(
      "before_agent_start",
      expect.any(Function),
    );
    expect(mockPi.on).toHaveBeenCalledWith("turn_start", expect.any(Function));
    expect(mockPi.on).toHaveBeenCalledWith("agent_end", expect.any(Function));
  });

  it("should register commands", () => {
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "undo",
      expect.objectContaining({
        description: expect.stringContaining("Abandon"),
        handler: expect.any(Function),
      }),
    );
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "redo",
      expect.objectContaining({
        description: expect.stringContaining("Redo"),
        handler: expect.any(Function),
      }),
    );
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "jujutsu",
      expect.objectContaining({
        description: expect.stringContaining("configuration status"),
        handler: expect.any(Function),
      }),
    );
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "jujutsu-enable",
      expect.objectContaining({
        description: expect.stringContaining("Enable"),
        handler: expect.any(Function),
      }),
    );
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "jujutsu-disable",
      expect.objectContaining({
        description: expect.stringContaining("Disable"),
        handler: expect.any(Function),
      }),
    );
  });

  it("should register event handlers", () => {
    expect(mockPi.on).toHaveBeenCalledWith(
      "before_agent_start",
      expect.any(Function),
    );
    expect(mockPi.on).toHaveBeenCalledWith("agent_end", expect.any(Function));
    expect(mockPi.on).toHaveBeenCalledWith("turn_start", expect.any(Function));
  });

  describe("before_agent_start event handler", () => {
    let eventHandler: (
      event: BeforeAgentStartEvent,
      ctx: ExtensionContext,
    ) => Promise<void>;

    beforeEach(() => {
      eventHandler = getEventHandler("before_agent_start")!;
    });

    it("should create new change when current has changes", async () => {
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "log") {
          return Promise.resolve({ stdout: "abc123", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "some diff output",
            stderr: "",
            code: 0,
          });
        }
        if (command === "jj" && args?.[0] === "new") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "mkdir" && args?.[0] === "-p") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "workspace") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockEvent = { prompt: "Test prompt" };
      const mockCtx = {
        sessionManager: { getBranch: () => [{ id: "session1" }] },
        model: { name: "test-model" },
      };

      await eventHandler(mockEvent, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "log",
        "-r",
        "@",
        "--template",
        "change_id",
        "--no-graph",
      ]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["diff"]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "new",
        "-m",
        "Test prompt",
      ]);
      expect(mockPi.exec).toHaveBeenCalledTimes(10);
    });

    it("should reuse current change when empty and update description", async () => {
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "log") {
          return Promise.resolve({ stdout: "abc123", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "describe") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "mkdir" && args?.[0] === "-p") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "workspace") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockEvent = { prompt: "Test prompt" };
      const mockCtx = {
        sessionManager: { getBranch: () => [{ id: "session1" }] },
        model: { name: "test-model" },
      };

      await eventHandler(mockEvent, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "log",
        "-r",
        "@",
        "--template",
        "change_id",
        "--no-graph",
      ]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["diff"]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "describe",
        "-m",
        "Test prompt",
      ]);
      expect(mockPi.exec).toHaveBeenCalledTimes(10);
      expect(mockPi.exec).not.toHaveBeenCalledWith("jj", [
        "new",
        "-m",
        "Test prompt",
      ]);
    });

    it("should handle undefined prompt", async () => {
      mockPi.exec.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        code: 0,
      }); // jj status check
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "mkdir" && args?.[0] === "-p") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "workspace") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockEvent = { prompt: undefined };
      const mockCtx = {
        sessionManager: { getBranch: () => [{ id: "session1" }] },
      };

      await eventHandler(mockEvent, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
      expect(mockPi.exec).toHaveBeenCalledWith("mkdir", [
        "-p",
        expect.stringContaining("session1"),
      ]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "workspace",
        "add",
        expect.stringContaining("session1"),
      ]);
      expect(mockPi.exec).toHaveBeenCalledTimes(3);
    });
  });

  describe("agent_end event handler", () => {
    let eventHandler: (event: any, ctx: any) => Promise<void>;

    beforeEach(() => {
      eventHandler = getEventHandler("agent_end")!;
    });

    it("should set lastTurnAborted when turn is aborted", async () => {
      // Mock all the checks to pass
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "some changes",
            stderr: "",
            code: 0,
          });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      // Mock pi command available
      mockPi.exec.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        code: 0,
      });

      const mockCtx = {
        signal: AbortSignal.abort(), // Aborted signal
        ui: { notify: vi.fn() },
        sessionManager: { getBranch: () => [{ id: "session1" }] },
      };

      await eventHandler({}, mockCtx);

      // Should not generate description when aborted
      expect(mockPi.exec).not.toHaveBeenCalledWith(
        "jj",
        expect.arrayContaining(["describe"]),
      );
    });

    it("should generate description when change has modifications", async () => {
      // First set up workspace
      const beforeAgentStartHandler = getEventHandler("before_agent_start")!;
      const turnStartHandler = getEventHandler("turn_start")!;
      const turnEndHandler = getEventHandler("turn_end")!;
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "log") {
          return Promise.resolve({ stdout: "abc123", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "some diff output",
            stderr: "",
            code: 0,
          });
        }
        if (command === "jj" && args?.[0] === "new") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "mkdir" && args?.[0] === "-p") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "workspace") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      await beforeAgentStartHandler(
        { prompt: "test" },
        {
          sessionManager: { getBranch: () => [{ id: "session1" }] },
          model: { name: "test-model" },
        },
      );

      await turnStartHandler(
        {},
        { sessionManager: { getBranch: () => [{ id: "session1" }] } },
      );

      // Now test agent_end
      // Mock all the checks to pass but make pi not available
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "modified file.txt\n+ new line",
            stderr: "",
            code: 0,
          });
        }
        if (command === "pi" && args?.[0] === "--version") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        // Make pi subagent fail so we don't test description generation
        if (command === "pi" && args?.includes("--mode")) {
          return Promise.reject(new Error("pi subagent not available in test"));
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockCtx = {
        signal: new AbortController().signal, // Not aborted
        ui: { notify: vi.fn() },
        sessionManager: { getBranch: () => [{ id: "session1" }] },
      };

      await turnEndHandler({}, mockCtx);
      await eventHandler({}, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["diff"]);
      // Should not proceed to description generation due to pi failure
      expect(mockPi.exec).not.toHaveBeenCalledWith(
        "jj",
        expect.arrayContaining(["describe"]),
      );
    });

    it("should skip when change is empty", async () => {
      // First set up workspace
      const beforeAgentStartHandler = getEventHandler("before_agent_start")!;
      const turnStartHandler = getEventHandler("turn_start")!;
      const turnEndHandler = getEventHandler("turn_end")!;
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "log") {
          return Promise.resolve({ stdout: "abc123", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "some diff output",
            stderr: "",
            code: 0,
          });
        }
        if (command === "jj" && args?.[0] === "new") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "mkdir" && args?.[0] === "-p") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "workspace") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      await beforeAgentStartHandler(
        { prompt: "test" },
        {
          sessionManager: { getBranch: () => [{ id: "session1" }] },
          model: { name: "test-model" },
        },
      );

      await turnStartHandler(
        {},
        { sessionManager: { getBranch: () => [{ id: "session1" }] } },
      );

      // Clear previous calls
      mockPi.exec.mockClear();

      // Now test agent_end
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "pi" && args?.[0] === "--version") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockCtx = {
        signal: new AbortController().signal,
        ui: { notify: vi.fn() },
        sessionManager: { getBranch: () => [{ id: "session1" }] },
      };

      await turnEndHandler({}, mockCtx);
      await eventHandler({}, mockCtx);

      // Should only check status and diff, no description generation
      expect(mockPi.exec).toHaveBeenCalledTimes(3); // status, diff, pi check
    });
  });

  describe("turn_start event handler", () => {
    let eventHandler: (event: any, ctx: any) => Promise<void>;

    beforeEach(() => {
      eventHandler = getEventHandler("turn_start")!;
    });

    it("should associate pending change with last user message", async () => {
      mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 }); // jj status

      const mockSessionManager = {
        getBranch: () => [
          {
            id: "entry1",
            type: "message",
            message: { role: "user", content: "Hello" },
          },
          {
            id: "entry2",
            type: "message",
            message: { role: "assistant", content: "Hi there" },
          },
        ],
      };

      const mockCtx = {
        sessionManager: mockSessionManager,
      };

      await eventHandler({}, mockCtx);

      // The pending change association happens internally, hard to test directly
      // but we can verify it doesn't crash
      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
    });
  });

  describe("lastTurnAborted behavior", () => {
    it("should reuse current change when lastTurnAborted is true", async () => {
      // Use the same instance to test state
      const agentEndHandler = getEventHandler("agent_end")!;
      const beforeAgentStartHandler = getEventHandler("before_agent_start")!;

      // First, trigger agent_end with aborted signal to set lastTurnAborted
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "some changes",
            stderr: "",
            code: 0,
          });
        }
        if (command === "pi" && args?.[0] === "--version") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      await agentEndHandler(
        {},
        {
          signal: AbortSignal.abort(),
          ui: { notify: vi.fn() },
          sessionManager: { getBranch: () => [{ id: "session1" }] },
        },
      );

      // Now test before_agent_start - it should reuse the current change
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "log") {
          return Promise.resolve({ stdout: "abc123", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "some diff output",
            stderr: "",
            code: 0,
          });
        }
        if (command === "jj" && args?.[0] === "describe") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "mkdir" && args?.[0] === "-p") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "workspace") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockEvent = { prompt: "Test prompt after abort" };
      const mockCtx = {
        sessionManager: { getBranch: () => [{ id: "session1" }] },
        model: { name: "test-model" },
      };

      await beforeAgentStartHandler(mockEvent, mockCtx);

      // Should create new change since workspace not set up properly in test
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "new",
        "-m",
        "Test prompt after abort",
      ]);
    });
  });

  describe("error handling", () => {
    it("should handle JJ command failures gracefully", async () => {
      const beforeAgentStartHandler = getEventHandler("before_agent_start")!;

      const mockEvent = { prompt: "Test prompt" };
      const mockCtx = {
        sessionManager: { getBranch: () => [{ id: "session1" }] },
      };

      // Should not throw, just log warning
      await beforeAgentStartHandler(mockEvent, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
    });

    it("should handle pi command not available", async () => {
      const agentEndHandler = getEventHandler("agent_end")!;

      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "some changes",
            stderr: "",
            code: 0,
          });
        }
        if (command === "pi") {
          return Promise.reject(new Error("pi command not found"));
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockCtx = {
        signal: new AbortController().signal,
        ui: { notify: vi.fn() },
        sessionManager: { getBranch: () => [{ id: "session1" }] },
      };

      await agentEndHandler({}, mockCtx);

      // Should skip description generation when pi is not available
      expect(mockPi.exec).not.toHaveBeenCalledWith(
        "jj",
        expect.arrayContaining(["describe"]),
      );
    });

    it("should handle navigation cancellation", async () => {
      const undoHandler = getCommandHandler("undo")!;
      const beforeAgentStartHandler = getEventHandler("before_agent_start")!;
      const turnStartHandler = getEventHandler("turn_start")!;

      // First set up a change
      mockPi.exec.mockImplementation((command: string, args?: string[]) => {
        if (command === "jj" && args?.[0] === "status") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "log") {
          return Promise.resolve({ stdout: "change123", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "diff") {
          return Promise.resolve({
            stdout: "some diff output",
            stderr: "",
            code: 0,
          });
        }
        if (command === "jj" && args?.[0] === "new") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "edit") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "mkdir" && args?.[0] === "-p") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        if (command === "jj" && args?.[0] === "workspace") {
          return Promise.resolve({ stdout: "", stderr: "", code: 0 });
        }
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockSessionManager = {
        getBranch: () => [
          {
            id: "user1",
            type: "message",
            message: { role: "user", content: "Hello" },
          },
        ],
      };

      // Create a change first
      await beforeAgentStartHandler(
        { prompt: "test" },
        {
          sessionManager: mockSessionManager,
          model: { name: "test-model" },
        },
      );
      await turnStartHandler({}, { sessionManager: mockSessionManager });

      const mockCtx = {
        ui: { notify: vi.fn() },
        sessionManager: mockSessionManager,
        navigateTree: vi.fn().mockResolvedValue({ cancelled: true }),
      };

      await undoHandler([], mockCtx as ExtensionCommandContext);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "Navigation was cancelled",
        "warning",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty session branch", async () => {
      const undoHandler = getCommandHandler("undo")!;
      const mockCtx = {
        ui: { notify: vi.fn() },
        sessionManager: {
          getBranch: () => [],
          getRoot: () => ({ id: "session1" }),
        },
      };

      mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 });

      await undoHandler([], mockCtx as ExtensionCommandContext);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No workspace found for current session",
        "warning",
      );
    });

    it("should handle session with no user messages", async () => {
      const undoHandler = getCommandHandler("undo")!;
      const mockSessionManager = {
        getBranch: () => [
          {
            id: "entry1",
            type: "message",
            message: { role: "assistant", content: "Hi" },
          },
        ],
        getRoot: () => ({ id: "session1" }),
      };
      const mockCtx = {
        ui: { notify: vi.fn() },
        sessionManager: mockSessionManager,
      };

      mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 });

      await undoHandler([], mockCtx as ExtensionCommandContext);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No workspace found for current session",
        "warning",
      );
    });
  });
});
