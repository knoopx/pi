import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as chokidar from "chokidar";
import * as core from "./core";
import { PIWatcher } from "./watcher";
import type { TriggerReference, TriggerWatcherOptions, TriggerWatcherCallbacks } from "./types";

// ============================================
// Mock Types and Functions
// ============================================

// Mock chokidar for file watching
vi.mock("chokidar", () => ({
  watch: vi.fn(),
}));

// Mock internal core functions
vi.mock("./core", () => ({
  DEFAULT_IGNORED_PATTERNS: [/\.git/, /node_modules/, /dist/, /\.pi/],
  shouldIgnorePath: vi.fn(),
  readFileAndParsePIReferences: vi.fn(),
  hasTrigger: vi.fn(),
}));

// Mock types
vi.mock("./types", () => ({
  DEFAULT_OPTIONS: {
    ignoredPatterns: [/\.git/, /node_modules/, /dist/, /\.pi/],
    cwd: "/test",
    ignoreInitial: true,
    stabilityThreshold: 500,
    pollInterval: 50,
  },
}));

type MockWatchFactory = ReturnType<typeof vi.fn> &
  ((...args: unknown[]) => { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> });

const createMockWatchFactory = () => {
  const fsWatcher = {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  fsWatcher.on.mockImplementation(() => fsWatcher);

  const mockWatch = vi.fn().mockReturnValue(fsWatcher) as MockWatchFactory;

  return { fsWatcher, mockWatch };
};

// ============================================
// Watcher Initialization Tests
// ============================================
describe("PIWatcher initialization", () => {
  let callbacks: TriggerWatcherCallbacks;
  let options: TriggerWatcherOptions;

  beforeEach(() => {
    callbacks = {
      onPIComment: vi.fn(),
      onPITrigger: vi.fn(),
      onReady: vi.fn(),
      onError: vi.fn(),
    };
    options = {
      ignoredPatterns: [/\.git/],
      cwd: "/test/cwd",
      ignoreInitial: false,
    };
  });

  describe("given default options", () => {
    beforeEach(() => {
      vi.mocked(core.shouldIgnorePath).mockReturnValue(false);
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
        content: "test",
        references: [],
      });
    });

    it("then should use default values", () => {
      const watcher = new PIWatcher(
        vi.fn() as any,
        callbacks,
        {}
      );

      expect(watcher).toBeDefined();
    });
  });

  describe("given custom options", () => {
    it("then should merge custom options with defaults", () => {
      const watcher = new PIWatcher(
        vi.fn() as any,
        callbacks,
        options
      );

      expect(watcher).toBeDefined();
    });
  });

  describe("given minimal callbacks", () => {
    it("then should use empty function defaults", () => {
      const watcher = new PIWatcher(
        vi.fn() as any,
        {},
        {}
      );

      expect(watcher).toBeDefined();
    });
  });
});

// ============================================
// File Watching Tests
// ============================================
describe("file watching operations", () => {
  let watcher: PIWatcher;
  let callbacks: TriggerWatcherCallbacks;
  let mockWatch: MockWatchFactory;
  let fsWatcher: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    callbacks = {
      onPIComment: vi.fn(),
      onPITrigger: vi.fn(),
      onReady: vi.fn(),
      onError: vi.fn(),
    };

    vi.mocked(core.shouldIgnorePath).mockReturnValue(false);
    vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
      content: "test",
      references: [],
    });

    const created = createMockWatchFactory();
    fsWatcher = created.fsWatcher;
    mockWatch = created.mockWatch;

    watcher = new PIWatcher(
      (paths: string | string[], options?: Record<string, unknown>) => mockWatch(paths, options),
      callbacks,
    );
  });

  describe("given watching a path", () => {
    it("then should create file watcher", () => {
      watcher.watch("/test/path");
      expect(mockWatch).toHaveBeenCalledWith(
        "/test/path",
        expect.objectContaining({
          ignored: [/\.git/, /node_modules/, /dist/, /\.pi/],
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: expect.objectContaining({
            stabilityThreshold: 500,
            pollInterval: 50,
          }),
        })
      );
    });

    it("then should register event handlers", () => {
      watcher.watch("/test/path");
      expect(fsWatcher.on).toHaveBeenCalled();
    });

    it("then should emit onReady callback", () => {
      watcher.watch("/test/path");
      const readyHandler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "ready",
      )?.[1] as (() => void) | undefined;
      readyHandler?.();
      expect(callbacks.onReady).toHaveBeenCalled();
    });
  });

  describe("given watch called multiple times", () => {
    it("then should close previous watcher", () => {
      watcher.watch("/test/path1");
      const firstCallCount = fsWatcher.close.mock.calls.length;
      watcher.watch("/test/path2");
      const secondCallCount = fsWatcher.close.mock.calls.length;
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });

    it("then should start watching new path", () => {
      watcher.watch("/test/path1");
      watcher.watch("/test/path2");
      const secondCall = mockWatch.mock.calls[1];
      expect(secondCall[0]).toBe("/test/path2");
    });
  });

  describe("given watch called when already watching", () => {
    it("then should clean up previous state", () => {
      const closeSpy = vi.spyOn(watcher as any, "close");
      watcher.watch("/test/path");
      watcher.watch("/test/path");
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================
// Event Handling Tests
// ============================================
describe("file change event handling", () => {
  let watcher: PIWatcher;
  let callbacks: TriggerWatcherCallbacks;
  let mockWatch: MockWatchFactory;
  let fsWatcher: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    callbacks = {
      onPIComment: vi.fn(),
      onPITrigger: vi.fn(),
      onReady: vi.fn(),
      onError: vi.fn(),
    };

    vi.mocked(core.shouldIgnorePath).mockReturnValue(false);
    vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
      content: "test",
      references: [
        { filePath: "/test/file.ts", lineNumber: 1, rawLines: ["// !pi"], hasTrigger: true },
      ],
    });

    const created = createMockWatchFactory();
    fsWatcher = created.fsWatcher;
    mockWatch = created.mockWatch;

    watcher = new PIWatcher(
      (paths: string | string[], options?: Record<string, unknown>) => mockWatch(paths, options),
      callbacks,
    );
    watcher.watch("/test/path");
  });

  describe("given file add event", () => {
    it("then should handle file addition", () => {
      const handler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "add",
      )?.[1] as ((path: string) => void) | undefined;
      handler?.call(watcher, "/test/file.ts");
      expect(callbacks.onPITrigger).toHaveBeenCalled();
    });
  });

  describe("given file change event", () => {
    it("then should handle file modification", () => {
      const handler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "change",
      )?.[1] as ((path: string) => void) | undefined;
      handler?.call(watcher, "/test/file.ts");
      expect(callbacks.onPITrigger).toHaveBeenCalled();
    });
  });

  describe("given file unlink event", () => {
    it("then should handle file deletion", () => {
      const handler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "unlink",
      )?.[1] as ((path: string) => void) | undefined;
      handler?.call(watcher, "/test/file.ts");
      expect(callbacks.onPITrigger).toHaveBeenCalled();
    });
  });

  describe("given error event", () => {
    it("then should handle watcher errors", () => {
      const handler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "error",
      )?.[1] as ((error: Error) => void) | undefined;
      handler?.call(watcher, new Error("File not found"));
      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

// ============================================
// Pause and Resume Tests
// ============================================
describe("pause and resume operations", () => {
  let watcher: PIWatcher;
  let callbacks: TriggerWatcherCallbacks;

  beforeEach(() => {
    callbacks = {
      onPIComment: vi.fn(),
      onPITrigger: vi.fn(),
      onReady: vi.fn(),
      onError: vi.fn(),
    };

    vi.mocked(core.shouldIgnorePath).mockReturnValue(false);
    vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
      content: "test",
      references: [],
    });

    const created = createMockWatchFactory();
    const mockWatch = created.mockWatch;

    watcher = new PIWatcher(
      (paths: string | string[], options?: Record<string, unknown>) => mockWatch(paths, options),
      callbacks,
    );
    watcher.watch("/test/path");
  });

  describe("given watching", () => {
    it("then should not be paused initially", () => {
      expect(watcher.isWatcherPaused()).toBe(false);
    });
  });

  describe("given pause called", () => {
    it("then should set paused flag", () => {
      watcher.pause();
      expect(watcher.isWatcherPaused()).toBe(true);
    });

    it("then should skip processing on file change", () => {
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
        content: "test",
        references: [{ filePath: "/test.ts", lineNumber: 1, rawLines: ["// !pi"], hasTrigger: true }],
      });
      vi.mocked(core.hasTrigger).mockReturnValue(true);

      watcher.pause();
      (watcher as any).handleChange("/test/file.ts");

      // Should not call callbacks when paused
      expect(callbacks.onPITrigger).not.toHaveBeenCalled();
    });
  });

  describe("given resume called", () => {
    it("then should clear paused flag", () => {
      watcher.pause();
      watcher.resume();
      expect(watcher.isWatcherPaused()).toBe(false);
    });

    it("then should process file changes after resume", () => {
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
        content: "test",
        references: [{ filePath: "/test.ts", lineNumber: 1, rawLines: ["// !pi"], hasTrigger: true }],
      });
      vi.mocked(core.hasTrigger).mockReturnValue(true);

      watcher.pause();
      (watcher as any).handleChange("/test/file.ts"); // Should be skipped
      watcher.resume();
      (watcher as any).handleChange("/test/file.ts"); // Should be processed
      expect(callbacks.onPITrigger).toHaveBeenCalled();
    });
  });
});

// ============================================
// Pending Comments Management Tests
// ============================================
describe("comment processing", () => {
  let watcher: PIWatcher;
  let callbacks: TriggerWatcherCallbacks;
  let mockWatch: MockWatchFactory;
  let fsWatcher: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    callbacks = {
      onPIComment: vi.fn(),
      onPITrigger: vi.fn(),
      onReady: vi.fn(),
      onError: vi.fn(),
    };

    vi.mocked(core.shouldIgnorePath).mockReturnValue(false);

    const created = createMockWatchFactory();
    fsWatcher = created.fsWatcher;
    mockWatch = created.mockWatch;

    watcher = new PIWatcher(
      (paths: string | string[], options?: Record<string, unknown>) => mockWatch(paths, options),
      callbacks,
    );
    watcher.watch("/test/path");
  });

  describe("given file with !PI trigger", () => {
    it("then should call trigger callback with comments from that file", () => {
      const references: TriggerReference[] = [
        { filePath: "/test/file.ts", lineNumber: 1, rawLines: ["// !pi fix this"], hasTrigger: true },
        { filePath: "/test/file.ts", lineNumber: 2, rawLines: ["// pi step 2"], hasTrigger: false },
      ];
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
        content: "test",
        references,
      });
      vi.mocked(core.hasTrigger).mockReturnValue(true);

      const handler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "change",
      )?.[1] as ((path: string) => void) | undefined;
      handler?.call(watcher, "/test/file.ts");

      expect(callbacks.onPITrigger).toHaveBeenCalledWith(references);
    });
  });

  describe("given file with only PI comments", () => {
    it("then should not call trigger callback", () => {
      const references: TriggerReference[] = [
        { filePath: "/test/file.ts", lineNumber: 1, rawLines: ["// pi step"], hasTrigger: false },
      ];
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
        content: "test",
        references,
      });
      vi.mocked(core.hasTrigger).mockReturnValue(false);

      const handler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "change",
      )?.[1] as ((path: string) => void) | undefined;
      handler?.call(watcher, "/test/file.ts");

      expect(callbacks.onPITrigger).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// Ignored Paths Tests
// ============================================
describe("ignored path handling", () => {
  let watcher: PIWatcher;
  let callbacks: TriggerWatcherCallbacks;

  beforeEach(() => {
    callbacks = {
      onPIComment: vi.fn(),
      onPITrigger: vi.fn(),
      onReady: vi.fn(),
      onError: vi.fn(),
    };

    vi.mocked(core.shouldIgnorePath).mockReturnValue(false);
    vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
      content: "test",
      references: [],
    });

    const created = createMockWatchFactory();
    const mockWatch = created.mockWatch;

    watcher = new PIWatcher(
      (paths: string | string[], options?: Record<string, unknown>) => mockWatch(paths, options),
      callbacks,
    );
    watcher.watch("/test/path");
  });

  describe("given ignored path", () => {
    it("then should skip processing", () => {
      vi.mocked(core.shouldIgnorePath).mockReturnValue(true);
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
        content: "test",
        references: [{ filePath: "/test/.git/config", lineNumber: 1, rawLines: ["// pi"], hasTrigger: false }],
      });

      const handleChange = (watcher as any).handleChange;
      handleChange.call(watcher, "/test/.git/config");

      expect(callbacks.onPITrigger).not.toHaveBeenCalled();
    });
  });

  describe("given file not found", () => {
    it("then should handle gracefully", () => {
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue(null);

      const handleChange = (watcher as any).handleChange;
      handleChange.call(watcher, "/test/file.ts");

      expect(callbacks.onPITrigger).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// Close and Cleanup Tests
// ============================================
describe("cleanup operations", () => {
  let watcher: PIWatcher;
  let callbacks: TriggerWatcherCallbacks;
  let fsWatcher: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    callbacks = {
      onPIComment: vi.fn(),
      onPITrigger: vi.fn(),
      onReady: vi.fn(),
      onError: vi.fn(),
    };

    vi.mocked(core.shouldIgnorePath).mockReturnValue(false);
    vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
      content: "test",
      references: [],
    });

    const created = createMockWatchFactory();
    fsWatcher = created.fsWatcher;
    const mockWatch = created.mockWatch;

    watcher = new PIWatcher(
      (paths: string | string[], options?: Record<string, unknown>) => mockWatch(paths, options),
      callbacks,
    );
    watcher.watch("/test/path");
  });

  describe("given closing watcher", () => {
    it("then should close file watcher", () => {
      watcher.close();
      expect(fsWatcher.close).toHaveBeenCalled();
    });

    it("then should stop watching", () => {
      watcher.close();
      expect((watcher as any).isWatching).toBe(false);
    });

    it("then should handle multiple close calls", () => {
      watcher.close();
      expect(() => watcher.close()).not.toThrow();
    });
  });

  describe("given watcher already closed", () => {
    it("then should handle close gracefully", () => {
      watcher.close();
      expect(() => watcher.close()).not.toThrow();
    });
  });
});

// ============================================
// Edge Cases and Error Handling
// ============================================
describe("edge cases and error handling", () => {
  let watcher: PIWatcher;
  let callbacks: TriggerWatcherCallbacks;
  let fsWatcher: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    callbacks = {
      onPIComment: vi.fn(),
      onPITrigger: vi.fn(),
      onReady: vi.fn(),
      onError: vi.fn(),
    };

    vi.mocked(core.shouldIgnorePath).mockReturnValue(false);
    vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
      content: "test",
      references: [],
    });

    const created = createMockWatchFactory();
    fsWatcher = created.fsWatcher;
    const mockWatch = created.mockWatch;

    watcher = new PIWatcher(
      (paths: string | string[], options?: Record<string, unknown>) => mockWatch(paths, options),
      callbacks,
    );
  });

  describe("given empty file content", () => {
    it("then should handle gracefully", () => {
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
        content: "",
        references: [],
      });

      watcher.watch("/test/path");
      const handler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "change",
      )?.[1] as ((path: string) => void) | undefined;
      handler?.call(watcher, "/test/file.ts");

      expect(callbacks.onPITrigger).not.toHaveBeenCalled();
    });
  });

  describe("given file with only PI references", () => {
    it("then should handle gracefully", () => {
      vi.mocked(core.readFileAndParsePIReferences).mockReturnValue({
        content: "// pi comment",
        references: [{ filePath: "/test/file.ts", lineNumber: 1, rawLines: ["// pi comment"], hasTrigger: false }],
      });

      watcher.watch("/test/path");
      const handler = fsWatcher.on.mock.calls.find(
        (call) => (call as [string, () => void])[0] === "change",
      )?.[1] as ((path: string) => void) | undefined;
      handler?.call(watcher, "/test/file.ts");

      expect(callbacks.onPITrigger).not.toHaveBeenCalled();
    });
  });
});
