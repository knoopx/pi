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
      getFlag: vi.fn(),
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
      getFlag: vi.fn(),
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
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockEvent = { prompt: "Test prompt" };
      const mockCtx = {};

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
      expect(mockPi.exec).toHaveBeenCalledTimes(4);
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
        return Promise.resolve({ stdout: "", stderr: "", code: 0 });
      });

      const mockEvent = { prompt: "Test prompt" };
      const mockCtx = {};

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
      expect(mockPi.exec).toHaveBeenCalledTimes(4);
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

      const mockEvent = { prompt: undefined };
      const mockCtx = {};

      await eventHandler(mockEvent, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
      expect(mockPi.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe("command handlers", () => {
    it("should handle undo with no changes", async () => {
      const undoHandler = getCommandHandler("undo")!;
      const mockCtx = {
        ui: { notify: vi.fn() },
        sessionManager: { getBranch: () => [] },
      };

      // Mock jj status check
      mockPi.exec.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        code: 0,
      });

      await undoHandler([], mockCtx as ExtensionCommandContext);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No changes available to revert to",
        "warning",
      );
    });

    it("should handle redo with no redo stack", async () => {
      const redoHandler = getCommandHandler("redo")!;
      const mockCtx = {
        ui: { notify: vi.fn() },
      };

      // Mock jj status check
      mockPi.exec.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        code: 0,
      });

      await redoHandler([], mockCtx as ExtensionCommandContext);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No undo operation to redo",
        "warning",
      );
    });
  });
});
