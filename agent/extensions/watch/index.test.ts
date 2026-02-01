import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import setupWatchExtension from "./index";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ============================================
// Mock Types and Functions
// ============================================

// Mock the internal dependencies
vi.mock("chokidar", () => ({
  default: { watch: vi.fn() },
  watch: vi.fn(),
}));

// Shared mock watcher instance
let mockWatcherInstance: {
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  watch: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} | null = null;

vi.mock("./watcher.js", () => {
  class MockPIWatcher {
    pause = vi.fn();
    resume = vi.fn();
    watch = vi.fn();
    close = vi.fn();

    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      mockWatcherInstance = this;
    }
  }

  return { PIWatcher: MockPIWatcher };
});

interface MockCommand {
  description: string;
  handler: (args: string, ctx: { ui: { notify: ReturnType<typeof vi.fn> } }) => Promise<void>;
}

interface MockPi {
  on: ReturnType<typeof vi.fn>;
  registerCommand: ReturnType<typeof vi.fn>;
  sendUserMessage: ReturnType<typeof vi.fn>;
  _handlers?: Record<string, unknown>;
  _commands?: Record<string, MockCommand>;
}

const createMockPi = (): MockPi => {
  const handlers: Record<string, unknown> = {};
  const commands: Record<string, MockCommand> = {};
  return {
    on: vi.fn().mockImplementation((event: string, handler: unknown) => {
      handlers[event] = handler;
    }),
    registerCommand: vi.fn().mockImplementation((name: string, options: MockCommand) => {
      commands[name] = options;
    }),
    sendUserMessage: vi.fn(),
    _handlers: handlers,
    _commands: commands,
  };
};

// ============================================
// Extension Registration Tests
// ============================================
describe("Watch Extension", () => {
  let mockPi: MockPi;

  beforeEach(() => {
    mockPi = createMockPi();
    mockWatcherInstance = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Command Registration
  // ============================================
  describe("extension registration", () => {
    beforeEach(() => {
      setupWatchExtension(mockPi as unknown as ExtensionAPI);
    });

    describe("given extension is initialized", () => {
      describe("when registering command and event handlers", () => {
        it("then it should register /watch command", () => {
          expect(mockPi.registerCommand).toHaveBeenCalledWith("watch", expect.objectContaining({
            description: expect.any(String),
            handler: expect.any(Function),
          }));
        });

        it("then it should register session_start handler", () => {
          const calls = mockPi.on.mock.calls;
          expect(calls.some((call: unknown[]) => call[0] === "session_start")).toBe(true);
        });

        it("then it should register agent_start handler", () => {
          const calls = mockPi.on.mock.calls;
          expect(calls.some((call: unknown[]) => call[0] === "agent_start")).toBe(true);
        });

        it("then it should register agent_end handler", () => {
          const calls = mockPi.on.mock.calls;
          expect(calls.some((call: unknown[]) => call[0] === "agent_end")).toBe(true);
        });

        it("then it should register session_shutdown handler", () => {
          const calls = mockPi.on.mock.calls;
          expect(calls.some((call: unknown[]) => call[0] === "session_shutdown")).toBe(true);
        });

        it("then handlers should be async functions", () => {
          Object.values(mockPi._handlers || {}).forEach((handler: unknown) => {
            expect(typeof handler).toBe("function");
          });
        });
      });
    });
  });

  // ============================================
  // Watch Command Tests
  // ============================================
  describe("/watch command", () => {
    beforeEach(() => {
      setupWatchExtension(mockPi as unknown as ExtensionAPI);
    });

    describe("given /watch on is executed", () => {
      it("then it should enable watch mode", async () => {
        const mockNotify = vi.fn();
        const ctx = { hasUI: true, cwd: "/test", ui: { notify: mockNotify } };

        // First trigger session_start to set watchCwd
        const sessionStartHandler = mockPi._handlers?.session_start as
          | ((event: unknown, context: typeof ctx) => Promise<void>)
          | undefined;
        await sessionStartHandler?.({}, ctx);

        const watchCommand = mockPi._commands?.watch;
        await watchCommand?.handler("on", ctx);

        expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining("Watch enabled"), "info");
      });
    });

    describe("given /watch off is executed", () => {
      it("then it should disable watch mode", async () => {
        const mockNotify = vi.fn();
        const ctx = { hasUI: true, cwd: "/test", ui: { notify: mockNotify } };

        // First trigger session_start to set watchCwd
        const sessionStartHandler = mockPi._handlers?.session_start as
          | ((event: unknown, context: typeof ctx) => Promise<void>)
          | undefined;
        await sessionStartHandler?.({}, ctx);

        const watchCommand = mockPi._commands?.watch;
        await watchCommand?.handler("on", ctx);
        mockNotify.mockClear();
        await watchCommand?.handler("off", ctx);

        expect(mockNotify).toHaveBeenCalledWith("Watch disabled", "info");
      });
    });

    describe("given /watch (toggle) is executed", () => {
      it("then it should toggle watch mode on when disabled", async () => {
        const mockNotify = vi.fn();
        const ctx = { hasUI: true, cwd: "/test", ui: { notify: mockNotify } };

        // First trigger session_start to set watchCwd
        const sessionStartHandler = mockPi._handlers?.session_start as
          | ((event: unknown, context: typeof ctx) => Promise<void>)
          | undefined;
        await sessionStartHandler?.({}, ctx);

        const watchCommand = mockPi._commands?.watch;
        await watchCommand?.handler("", ctx);

        expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining("Watch toggled on"), "info");
      });

      it("then it should toggle watch mode off when enabled", async () => {
        const mockNotify = vi.fn();
        const ctx = { hasUI: true, cwd: "/test", ui: { notify: mockNotify } };

        // First trigger session_start to set watchCwd
        const sessionStartHandler = mockPi._handlers?.session_start as
          | ((event: unknown, context: typeof ctx) => Promise<void>)
          | undefined;
        await sessionStartHandler?.({}, ctx);

        const watchCommand = mockPi._commands?.watch;
        await watchCommand?.handler("on", ctx);
        mockNotify.mockClear();
        await watchCommand?.handler("", ctx);

        expect(mockNotify).toHaveBeenCalledWith("Watch toggled off", "info");
      });
    });
  });

  // ============================================
  // Session Start Handler Tests
  // ============================================
  describe("session_start event handler", () => {
    beforeEach(() => {
      setupWatchExtension(mockPi as unknown as ExtensionAPI);
    });

    describe("given watch mode is disabled", () => {
      it("then it should not create watcher", async () => {
        const handler = mockPi._handlers?.session_start as
          | ((event: unknown, context: unknown) => Promise<void>)
          | undefined;

        await handler?.(
          {},
          { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } },
        );

        expect(mockWatcherInstance).toBeNull();
      });
    });

    describe("given watch mode is enabled", () => {
      it("then it should create a PIWatcher instance", async () => {
        const ctx = { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } };
        const sessionStartHandler = mockPi._handlers?.session_start as
          | ((event: unknown, context: typeof ctx) => Promise<void>)
          | undefined;

        // Start session first
        await sessionStartHandler?.({}, ctx);

        // Enable watch
        const watchCommand = mockPi._commands?.watch;
        await watchCommand?.handler("on", ctx);

        expect(mockWatcherInstance).not.toBeNull();
      });
    });
  });

  // ============================================
  // Agent Start Handler Tests
  // ============================================
  describe("agent_start event handler", () => {
    beforeEach(async () => {
      setupWatchExtension(mockPi as unknown as ExtensionAPI);

      // Set up watcher
      const ctx = { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } };
      const sessionStartHandler = mockPi._handlers?.session_start as
        | ((event: unknown, context: typeof ctx) => Promise<void>)
        | undefined;
      await sessionStartHandler?.({}, ctx);

      const watchCommand = mockPi._commands?.watch;
      await watchCommand?.handler("on", ctx);
    });

    describe("given watcher is active", () => {
      it("then it should pause the watcher", async () => {
        const handler = mockPi._handlers?.agent_start as
          | (() => Promise<void>)
          | undefined;

        await handler?.();

        expect(mockWatcherInstance?.pause).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Agent End Handler Tests
  // ============================================
  describe("agent_end event handler", () => {
    let ctx: { hasUI: boolean; cwd: string; ui: { notify: ReturnType<typeof vi.fn> } };

    beforeEach(async () => {
      setupWatchExtension(mockPi as unknown as ExtensionAPI);

      ctx = { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } };
      const sessionStartHandler = mockPi._handlers?.session_start as
        | ((event: unknown, context: typeof ctx) => Promise<void>)
        | undefined;
      await sessionStartHandler?.({}, ctx);

      const watchCommand = mockPi._commands?.watch;
      await watchCommand?.handler("on", ctx);
    });

    describe("given watcher is active", () => {
      it("then it should resume the watcher", async () => {
        const handler = mockPi._handlers?.agent_end as
          | (() => Promise<void>)
          | undefined;

        await handler?.();

        expect(mockWatcherInstance?.resume).toHaveBeenCalled();
      });

      it("then it should notify UI if hasUI", async () => {
        const handler = mockPi._handlers?.agent_end as
          | (() => Promise<void>)
          | undefined;

        await handler?.();

        expect(ctx.ui.notify).toHaveBeenCalledWith(
          expect.stringContaining("Watching"),
          "info"
        );
      });
    });
  });

  // ============================================
  // Session Shutdown Handler Tests
  // ============================================
  describe("session_shutdown event handler", () => {
    beforeEach(async () => {
      setupWatchExtension(mockPi as unknown as ExtensionAPI);

      const ctx = { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } };
      const sessionStartHandler = mockPi._handlers?.session_start as
        | ((event: unknown, context: typeof ctx) => Promise<void>)
        | undefined;
      await sessionStartHandler?.({}, ctx);

      const watchCommand = mockPi._commands?.watch;
      await watchCommand?.handler("on", ctx);
    });

    describe("given watcher is active", () => {
      it("then it should close the watcher", async () => {
        const handler = mockPi._handlers?.session_shutdown as
          | (() => Promise<void>)
          | undefined;

        await handler?.();

        expect(mockWatcherInstance?.close).toHaveBeenCalled();
      });
    });
  });
});
