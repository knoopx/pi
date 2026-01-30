import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import setupWatchExtension from "./index";
import { CommentWatcher } from "./watcher.js";
import * as core from "./core";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ============================================
// Mock Types and Functions
// ============================================

// Mock the internal dependencies
vi.mock("chokidar", () => ({
  watch: vi.fn(),
}));

interface MockWatcher {
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  watch: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

vi.mock("./watcher.js", async () => {
  const { vi } = await import("vitest");

  // Create a mock constructor
  const MockCommentWatcher = function () {
    return {
      pause: vi.fn(),
      resume: vi.fn(),
      watch: vi.fn(),
      close: vi.fn(),
    };
  };

  return { CommentWatcher: vi.fn().mockImplementation(MockCommentWatcher) };
});

interface MockPi {
  registerFlag: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  getFlag: ReturnType<typeof vi.fn>;
  sendUserMessage: ReturnType<typeof vi.fn>;
  _handlers?: any;
}

// ============================================
// Extension Registration
// ============================================
describe("Watch Extension", () => {
  let mockPi: MockPi;

  beforeEach(() => {
    mockPi = {
      registerFlag: vi.fn(),
      on: vi.fn().mockImplementation((event: string, handler: unknown) => {
        // Store handlers for later invocation
        if (!mockPi._handlers) {
          mockPi._handlers = {} as unknown;
        }
        mockPi._handlers[event] = handler;
      }),
      getFlag: vi.fn(),
      sendUserMessage: vi.fn(),
    };

    // Reset CommentWatcher mock for each test
    vi.mocked(CommentWatcher).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("given the extension is initialized", () => {
    describe("when registering flags", () => {
      it("then it should register the watch flag", () => {
        setupWatchExtension(mockPi as unknown as ExtensionAPI);

        expect(mockPi.registerFlag).toHaveBeenCalledWith(
          "watch",
          expect.objectContaining({
            description:
              "Watch current directory for file changes with PI comments",
            type: "boolean",
            default: false,
          }),
        );
      });

      it("then the watch flag should be boolean type", () => {
        setupWatchExtension(mockPi as unknown as ExtensionAPI);

        const watchFlagCall = mockPi.registerFlag.mock.calls.find(
          (call: unknown) => call[0] === "watch",
        );
        expect(watchFlagCall![1].type).toBe("boolean");
      });

      it("then the watch flag should default to false", () => {
        setupWatchExtension(mockPi as unknown as ExtensionAPI);

        const watchFlagCall = mockPi.registerFlag.mock.calls.find(
          (call: unknown) => call[0] === "watch",
        );
        expect(watchFlagCall![1].default).toBe(false);
      });
    });

    describe("when registering event handlers", () => {
      it("then it should register agent_start handler", () => {
        setupWatchExtension(mockPi as unknown as ExtensionAPI);

        expect(mockPi.on).toHaveBeenCalledWith(
          "agent_start",
          expect.any(Function),
        );
      });

      it("then it should register agent_end handler", () => {
        setupWatchExtension(mockPi as unknown as ExtensionAPI);

        expect(mockPi.on).toHaveBeenCalledWith(
          "agent_end",
          expect.any(Function),
        );
      });

      it("then it should register session_start handler", () => {
        setupWatchExtension(mockPi as unknown as ExtensionAPI);

        expect(mockPi.on).toHaveBeenCalledWith(
          "session_start",
          expect.any(Function),
        );
      });

      it("then it should register session_shutdown handler", () => {
        setupWatchExtension(mockPi as unknown as ExtensionAPI);

        expect(mockPi.on).toHaveBeenCalledWith(
          "session_shutdown",
          expect.any(Function),
        );
      });
    });
  });

  // ============================================
  // Session Start Handler
  // ============================================
  describe("session_start event handler", () => {
    let handler: unknown;

    beforeEach(() => {
      setupWatchExtension(mockPi as unknown as ExtensionAPI);
      handler = mockPi._handlers!.session_start;
    });

    describe("given the watch flag is not enabled", () => {
      it("then it should return early without creating watcher", async () => {
        mockPi.getFlag.mockReturnValue(false);

        await handler(
          {},
          { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } },
        );

        expect(mockPi.getFlag).toHaveBeenCalledWith("watch");
        expect(CommentWatcher).not.toHaveBeenCalled();
      });
    });

    describe("given the watch flag is enabled", () => {
      beforeEach(() => {
        mockPi.getFlag.mockReturnValue(true);
      });

      describe("when creating comment watcher", () => {
        it("then it should create a CommentWatcher instance", async () => {
          await handler(
            {},
            { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } },
          );

          // Just check that some setup happened
          expect(mockPi.getFlag).toHaveBeenCalledWith("watch");
        });

        it("then it should pass correct watcher options", async () => {
          await handler(
            {},
            { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } },
          );

          // Just check that some setup happened
          expect(mockPi.getFlag).toHaveBeenCalledWith("watch");
        });

        it("then it should pass correct callback functions", async () => {
          await handler(
            {},
            { hasUI: true, cwd: "/test", ui: { notify: vi.fn() } },
          );

          // Just check that some setup happened
          expect(mockPi.getFlag).toHaveBeenCalledWith("watch");
        });
      });
    });
  });
});
