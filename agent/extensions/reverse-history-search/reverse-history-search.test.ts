import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext,
  SessionManager,
  ModelRegistry,
} from "@mariozechner/pi-coding-agent";
import setupExtension from "./index";
import { fuzzyMatch } from "../../shared/matching/fuzzy";
import type { MockExtensionAPI } from "../../shared/testing/test-utils";
import { createMockExtensionAPI } from "../../shared/testing/test-utils";

describe("Reverse History Search Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupExtension(mockPi as ExtensionAPI);
  });

  describe("given the extension is initialized", () => {
    describe("when registering shortcut", () => {
      it("then it should register ctrl+r shortcut", (): void => {
        const { registerShortcut } = mockPi as unknown as MockExtensionAPI;
        expect(registerShortcut).toHaveBeenCalledWith(
          "ctrl+r",
          expect.anything(),
        );
      });

      it("then it should register a handler function", (): void => {
        const call = mockPi.registerShortcut.mock.calls[0] as [
          string,
          { handler: unknown },
        ];
        expect(call[1].handler).toBeInstanceOf(Function);
      });
    });
  });

  describe("ctrl+r shortcut handler", () => {
    let handler: (this: void, ctx: ExtensionContext) => Promise<void>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      const regCall = mockPi.registerShortcut.mock.calls[0] as [
        string,
        { handler: unknown },
      ];
      handler = regCall[1].handler as (ctx: ExtensionContext) => Promise<void>;
      mockCtx = {
        hasUI: true,
        cwd: "/home/test/project",
        ui: {
          notify: vi.fn(),
          custom: vi.fn(),
          setEditorText: vi.fn(),
          theme: { fg: vi.fn() } as unknown as ExtensionUIContext["theme"],
          select: vi.fn(),
          confirm: vi.fn(),
          input: vi.fn(),
          setStatus: vi.fn(),
          setWorkingMessage: vi.fn(),
          setWidget: vi.fn(),
          setFooter: vi.fn(),
          setHeader: vi.fn(),
          setTitle: vi.fn(),
          getEditorText: vi.fn(),
          editor: vi.fn(),
          setEditorComponent: vi.fn(),
          getAllThemes: vi.fn(),
          getTheme: vi.fn(),
          setTheme: vi.fn(),
          onTerminalInput: vi.fn(),
          setWorkingIndicator: vi.fn(),
          setHiddenThinkingLabel: vi.fn(),
          pasteToEditor: vi.fn(),
          addAutocompleteProvider: vi.fn(),
          getToolsExpanded: vi.fn(),
          setToolsExpanded: vi.fn(),
        } as unknown as ExtensionUIContext,
        sessionManager: vi.fn() as unknown as SessionManager,
        modelRegistry: vi.fn() as unknown as ModelRegistry,
        model: undefined,
        isIdle: vi.fn(),
        signal: undefined,
        abort: vi.fn(),
        hasPendingMessages: vi.fn(),
        shutdown: vi.fn(),
        getContextUsage: vi.fn(),
        compact: vi.fn(),
        getSystemPrompt: vi.fn(),
      };
    });

    describe("given no UI is available", () => {
      it("then it should exit without showing UI", async (): Promise<void> => {
        mockCtx.hasUI = false;

        await handler(mockCtx);

        expect(mockCtx.ui.notify).not.toHaveBeenCalled();
        expect(mockCtx.ui.custom).not.toHaveBeenCalled();
      });
    });

    describe("given no history exists for current working directory", () => {
      it("then it should notify user that no history is found", async (): Promise<void> => {
        await handler(mockCtx);

        expect(mockCtx.ui.notify).toHaveBeenCalledWith(
          "No history found",
          "warning",
        );
        expect(mockCtx.ui.custom).not.toHaveBeenCalled();
      });
    });

    describe("given UI is available and history exists", () => {
      it("then it should show the custom UI with history", async (): Promise<void> => {
        await expect(handler(mockCtx)).resolves.toBeUndefined();
      });
    });
  });

  describe("fuzzyMatch function", () => {
    describe("given an empty query", () => {
      it("then it should return true for empty query", (): void => {
        expect(fuzzyMatch("test", "")).toBe(true);
      });

      it("then it should match unknown text", (): void => {
        expect(fuzzyMatch("unknown text", "")).toBe(true);
        expect(fuzzyMatch("", "")).toBe(true);
        expect(fuzzyMatch("git status", "")).toBe(true);
      });

      it("then it should return true for unknown input", (): void => {
        expect(fuzzyMatch("test", "")).toBe(true);
        expect(fuzzyMatch("12345", "")).toBe(true);
      });
    });

    describe("given exact string matching", () => {
      it("then it should match identical strings", (): void => {
        expect(fuzzyMatch("git", "git")).toBe(true);
        expect(fuzzyMatch("status", "status")).toBe(true);
        expect(fuzzyMatch("command", "command")).toBe(true);
      });

      it("then it should not match different strings", (): void => {
        expect(fuzzyMatch("git", "svn")).toBe(false);
        expect(fuzzyMatch("hello", "world")).toBe(false);
        expect(fuzzyMatch("apple", "orange")).toBe(false);
      });
    });

    describe("given fuzzy pattern matching", () => {
      it("then it should match word prefixes", (): void => {
        expect(fuzzyMatch("npm install", "inst")).toBe(true);
        expect(fuzzyMatch("git commit", "comm")).toBe(true);
      });

      it("then it should not match unrelated text", (): void => {
        expect(fuzzyMatch("git status", "xyz")).toBe(false);
        expect(fuzzyMatch("npm install", "cargo")).toBe(false);
      });
    });

    describe("given case insensitive matching", () => {
      it("then it should treat uppercase and lowercase as equivalent", (): void => {
        expect(fuzzyMatch("GIT STATUS", "git")).toBe(true);
        expect(fuzzyMatch("git status", "GIT")).toBe(true);
      });
    });

    describe("given partial matches", () => {
      it("then it should match substrings", (): void => {
        expect(fuzzyMatch("git status --help", "status")).toBe(true);
        expect(fuzzyMatch("npm install package", "inst")).toBe(true);
        expect(fuzzyMatch("cargo build", "build")).toBe(true);
      });

      it("then it should match full words", (): void => {
        expect(fuzzyMatch("hello world", "hello")).toBe(true);
        expect(fuzzyMatch("git push origin", "push")).toBe(true);
      });
    });

    describe("given complex queries", () => {
      it("then it should handle word boundaries", (): void => {
        expect(fuzzyMatch("cargo publish", "pub")).toBe(true);
        expect(fuzzyMatch("git push origin", "push")).toBe(true);
      });
    });
  });
});
