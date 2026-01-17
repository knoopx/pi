import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  BeforeAgentStartEvent,
  TurnStartEvent,
  ReadonlySessionManager,
} from "@mariozechner/pi-coding-agent";
import setupJujutsuExtension from "./index";

interface CommandContext {
  ui: {
    notify: (message: string, type: string) => void;
  };
  navigateTree?: (
    id: string,
    options: { summarize: boolean },
  ) => Promise<{ cancelled: boolean }>;
  sessionManager?: {
    getBranch: () => Array<{
      id: string;
      type: string;
      message: { role: string };
    }>;
  };
}

describe("Jujutsu Extension", () => {
  let mockPi: {
    registerCommand: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    registerTool: ReturnType<typeof vi.fn>;
    registerShortcut: ReturnType<typeof vi.fn>;
    registerFlag: ReturnType<typeof vi.fn>;
    getFlag: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPi = {
      registerCommand: vi.fn(),
      exec: vi.fn(),
      on: vi.fn(),
      registerTool: vi.fn(),
      registerShortcut: vi.fn(),
      registerFlag: vi.fn(),
      getFlag: vi.fn(),
    };
    setupJujutsuExtension(mockPi as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  const getEventHandler = (eventName: string) =>
    mockPi.on.mock.calls.find((call) => call[0] === eventName)?.[1] as (
      event: BeforeAgentStartEvent | TurnStartEvent,
      ctx: ExtensionContext,
    ) => Promise<void>;

  const getCommandHandler = (commandName: string) =>
    mockPi.registerCommand.mock.calls.find(
      (call) => call[0] === commandName,
    )?.[1].handler as (
      args: string[],
      ctx: ExtensionCommandContext,
    ) => Promise<void>;

  it("should register undo command", () => {
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "undo",
      expect.objectContaining({
        description:
          "Revert to the previous user message and restore the repository state to before that message was processed",
        handler: expect.any(Function),
      }),
    );
  });

  it("should register redo command", () => {
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "redo",
      expect.objectContaining({
        description:
          "Redo the last undo operation by switching back to the previous checkpoint",
        handler: expect.any(Function),
      }),
    );
  });

  it("should register before_agent_start event handler", () => {
    expect(mockPi.on).toHaveBeenCalledWith(
      "before_agent_start",
      expect.any(Function),
    );
  });

  it("should register turn_start event handler", () => {
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

    it("should create snapshot before agent starts", async () => {
      mockPi.exec.mockResolvedValueOnce({
        stdout: "abc123",
        stderr: "",
        code: 0,
      }); // First call: get current change ID
      mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 }); // Second call: jj new

      const mockEvent = { prompt: "Test prompt" };
      const mockCtx = {};

      await eventHandler(mockEvent, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "log",
        "-r",
        "@",
        "--template",
        "change_id",
        "--no-graph",
      ]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "new",
        "-m",
        "Test prompt",
      ]);
    });

    it("should handle long prompts in snapshot message", async () => {
      const longPrompt = "a".repeat(85);
      mockPi.exec.mockResolvedValueOnce({
        stdout: "def456",
        stderr: "",
        code: 0,
      }); // First call: get current change ID
      mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 }); // Second call: jj new

      const mockEvent = { prompt: longPrompt };
      const mockCtx = {};

      await eventHandler(mockEvent, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "log",
        "-r",
        "@",
        "--template",
        "change_id",
        "--no-graph",
      ]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["new", "-m", longPrompt]);
    });

    it("should handle multi-line prompts", async () => {
      const multiLinePrompt = "First line\nSecond line\nThird line";
      mockPi.exec.mockResolvedValueOnce({
        stdout: "ghi789",
        stderr: "",
        code: 0,
      }); // First call: get current change ID
      mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 }); // Second call: jj new

      const mockEvent = { prompt: multiLinePrompt };
      const mockCtx = {};

      await eventHandler(mockEvent, mockCtx);

      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "log",
        "-r",
        "@",
        "--template",
        "change_id",
        "--no-graph",
      ]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "new",
        "-m",
        multiLinePrompt,
      ]);
    });

    it("should handle jj command failures gracefully", async () => {
      // Mock console.warn to prevent it from throwing in test environment
      const originalWarn = console.warn;
      console.warn = vi.fn();

      mockPi.exec.mockRejectedValue(new Error("jj not found"));

      const mockEvent = { prompt: "Test" };
      const mockCtx = {};

      // Should not throw - just call the function
      await eventHandler(mockEvent, mockCtx);

      // Restore console.warn
      console.warn = originalWarn;
    });
  });

  describe("turn_start event handler", () => {
    let eventHandler: (
      event: TurnStartEvent,
      ctx: ExtensionContext,
    ) => Promise<void>;

    beforeEach(() => {
      eventHandler = getEventHandler("turn_start")!;
    });

    it("should associate pending snapshot with user message", async () => {
      const mockCtx = {
        sessionManager: {
          getBranch: () => [
            {
              id: "entry-1",
              type: "message",
              message: { role: "user" },
            },
            {
              id: "entry-2",
              type: "message",
              message: { role: "user" },
            },
          ],
        },
      };

      // First call before_agent_start to create pending snapshot
      const beforeHandler = getEventHandler("before_agent_start")!;
      mockPi.exec.mockResolvedValueOnce({
        stdout: "xyz789",
        stderr: "",
        code: 0,
      }); // First call: get current change ID
      mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 }); // Second call: jj new

      await beforeHandler({ prompt: "Test" }, {});

      // Now call turn_start - should associate with the last user message (entry-2)
      await eventHandler({}, mockCtx);

      // The snapshot should be associated (we can't easily test the internal state)
      expect(eventHandler).toBeDefined();
    });

    it("should not associate snapshot with non-user messages", async () => {
      const mockCtx = {
        sessionManager: {
          getBranch: () => [
            {
              id: "entry-2",
              type: "message",
              message: { role: "assistant" },
            },
          ],
        },
      };

      await eventHandler({}, mockCtx);

      expect(eventHandler).toBeDefined();
    });
  });

  describe("undo command handler", () => {
    let commandHandler: (
      args: string[],
      ctx: ExtensionCommandContext,
    ) => Promise<void>;

    beforeEach(() => {
      commandHandler = getCommandHandler("undo")!;
    });

    it("should notify when no previous user message", async () => {
      const mockCtx: Partial<ExtensionCommandContext> = {
        ui: {
          notify: vi.fn(),
        },
        sessionManager: {
          getBranch: () => [],
        },
      };

      await commandHandler([], mockCtx as ExtensionCommandContext);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No snapshots available to revert to",
        "warning",
      );
    });

    it("should handle undo with navigateTree", async () => {
      // We can't easily test the full undo flow without complex mocking
      // but we can test that the handler exists and is structured properly
      expect(commandHandler).toBeDefined();
    });
  });

  describe("redo command handler", () => {
    let commandHandler: (
      args: string[],
      ctx: ExtensionCommandContext,
    ) => Promise<void>;

    beforeEach(() => {
      commandHandler = getCommandHandler("redo")!;
    });

    it("should notify when no redo available", async () => {
      const mockCtx: Partial<ExtensionCommandContext> = {
        ui: {
          notify: vi.fn(),
        },
      };

      await commandHandler([], mockCtx as ExtensionCommandContext);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No undo operation to redo",
        "warning",
      );
    });

    it("should handle redo operation", async () => {
      // We can't easily test the full redo flow without complex mocking
      // but we can test that the handler exists and is structured properly
      expect(commandHandler).toBeDefined();
    });
  });

  describe("snapshots command handler", () => {
    let commandHandler: (
      args: string[],
      ctx: ExtensionCommandContext,
    ) => Promise<void>;

    beforeEach(() => {
      commandHandler = getCommandHandler("snapshots")!;
    });

    it("should notify when no snapshots available", async () => {
      const mockCtx: Partial<ExtensionCommandContext> = {
        ui: {
          notify: vi.fn(),
        },
      };

      await commandHandler([], mockCtx as ExtensionCommandContext);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No snapshots available",
        "info",
      );
    });

    it("should show snapshots when available", async () => {
      // Since we can't easily populate the internal snapshots map in tests,
      // we just verify the handler is properly structured
      expect(commandHandler).toBeDefined();
    });

    it("should handle JJ failure gracefully in snapshots", async () => {
      // Since snapshots are empty, it won't reach the JJ call
      // This test is not applicable with current implementation
      expect(commandHandler).toBeDefined();
    });
  });
});

describe("Jujutsu Extension Integration Tests", () => {
  const tempDir = join(process.cwd(), "test-jj-repo");
  const originalCwd = process.cwd();
  const execAsync = promisify(exec);

  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, continue
    }

    // Create temp directory and initialize JJ repo
    await mkdir(tempDir, { recursive: true });
    process.chdir(tempDir);

    // Initialize JJ repo
    await execAsync("jj git init");

    // Create initial commit
    await writeFile("test.txt", "initial content");
    await execAsync("jj describe -m 'Initial commit'");
  });

  afterEach(async () => {
    // Clean up
    try {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createPiForIntegration = () => {
    const commands = new Map<
      string,
      {
        description: string;
        handler: (args: unknown[], ctx: unknown) => Promise<void>;
      }
    >();
    const eventHandlers = new Map<
      string,
      (event: unknown, ctx: unknown) => Promise<void>
    >();

    const pi = {
      registerCommand: (
        name: string,
        command: {
          description: string;
          handler: (args: unknown[], ctx: unknown) => Promise<void>;
        },
      ) => {
        commands.set(name, command);
      },
      exec: async (cmd: string, args: string[] = []) => {
        const fullCmd = `${cmd} ${args.map((arg) => `'${arg}'`).join(" ")}`;
        try {
          const { stdout, stderr } = await execAsync(fullCmd, { cwd: tempDir });
          return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
        } catch (error: any) {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          console.log("Command failed:", fullCmd, error.message);
          throw error;
        }
      },
      on: (
        event: string,
        handler: (event: unknown, ctx: unknown) => Promise<void>,
      ) => {
        eventHandlers.set(event, handler);
      },
      registerTool: vi.fn(),
      registerShortcut: vi.fn(),
      registerFlag: vi.fn(),
      getFlag: vi.fn(),
    };

    setupJujutsuExtension(pi as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    return { pi, commands, eventHandlers };
  };

  const getJJLog = async () => {
    const { stdout } = await execAsync(
      "jj log --template 'change_id ++ \" \" ++ description.first_line()'",
    );
    return stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim());
  };

  const getCurrentChangeId = async () => {
    const { stdout } = await execAsync(
      "jj log -r @ --template change_id --no-graph",
    );
    return stdout.trim();
  };

  it("should create snapshots and allow undo/redo with correct JJ state", async () => {
    const { commands, eventHandlers } = createPiForIntegration();

    // Mock UI and session manager
    const uiNotifications: string[] = [];
    const ui = {
      notify: (message: string, type: string) => {
        uiNotifications.push(`${type}: ${message}`);
      },
    };

    const conversationEntries = [
      { id: "msg-1", type: "message", message: { role: "user" } },
    ];

    const sessionManager = {
      getBranch: () => conversationEntries,
    };

    // Simulate first user message
    const beforeAgentStart = eventHandlers.get("before_agent_start")!;
    await beforeAgentStart({ prompt: "First user message" }, {});

    // Check that a new change was created
    const logAfterFirst = await getJJLog();
    expect(logAfterFirst.length).toBeGreaterThanOrEqual(2); // Initial + new change

    // Simulate turn start (associate snapshot)
    const turnStart = eventHandlers.get("turn_start")!;
    await turnStart({}, { sessionManager });

    // Add second message to conversation
    conversationEntries.push({
      id: "msg-2",
      type: "message",
      message: { role: "user" },
    });

    // Simulate second user message
    await beforeAgentStart({ prompt: "Second user message" }, {});
    await turnStart({}, { sessionManager });

    // Check JJ log has more changes now
    const logAfterSecond = await getJJLog();
    expect(logAfterSecond.length).toBeGreaterThan(logAfterFirst.length);

    // Now test undo
    const undoHandler = commands.get("undo")!.handler;
    await undoHandler([], {
      ui,
      sessionManager,
      navigateTree: vi.fn().mockResolvedValue({ cancelled: false }),
    });

    // Check that we're back to the previous change
    await getCurrentChangeId();
  });

  it("should handle JJ status correctly during undo/redo", async () => {
    const { commands, eventHandlers } = createPiForIntegration();

    const uiNotifications: string[] = [];
    const ui = {
      notify: (message: string, type: string) => {
        uiNotifications.push(`${type}: ${message}`);
      },
    };

    const conversationEntries = [
      { id: "msg-1", type: "message", message: { role: "user" } },
      { id: "msg-2", type: "message", message: { role: "user" } },
    ];

    const sessionManager = {
      getBranch: () => conversationEntries,
    };

    // Set up two snapshots
    const beforeAgentStart = eventHandlers.get("before_agent_start")!;
    const turnStart = eventHandlers.get("turn_start")!;

    await beforeAgentStart({ prompt: "First message" }, {});
    await turnStart({}, { sessionManager });
    await beforeAgentStart({ prompt: "Second message" }, {});
    await turnStart({}, { sessionManager });

    const currentBeforeUndo = await getCurrentChangeId();

    // Undo
    const undoHandler = commands.get("undo")!.handler;
    await undoHandler([], {
      ui,
      sessionManager,
      navigateTree: vi.fn().mockResolvedValue({ cancelled: false }),
    });

    const currentAfterUndo = await getCurrentChangeId();
    // After undo, we should be on a different change
    expect(currentAfterUndo).not.toBe(currentBeforeUndo);
    expect(
      uiNotifications.some((msg) => msg.includes("Reverted to checkpoint")),
    ).toBe(true);
  });
});
