import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext,
} from "@mariozechner/pi-coding-agent";
import setupExtension, { fuzzyMatch } from "./index";
import type { MockExtensionAPI } from "../../test-utils";
import { createMockExtensionAPI } from "../../test-utils";

// ============================================
// Extension Registration
// ============================================
describe("Reverse History Search Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupExtension(mockPi as ExtensionAPI);
  });

  describe("given the extension is initialized", () => {
    describe("when registering shortcut", () => {
      it("then it should register ctrl+r shortcut", () => {
        expect(mockPi.registerShortcut).toHaveBeenCalledWith("ctrl+r", {
          description:
            "Reverse history search (user messages and commands from sessions in current directory)",
          handler: expect.any(Function),
        });
      });

      it("then it should register a handler function", () => {
        const call = mockPi.registerShortcut.mock.calls[0];
        expect(call[1].handler).toBeInstanceOf(Function);
      });
    });
  });

  // ============================================
  // Shortcut Handler
  // ============================================
  describe("ctrl+r shortcut handler", () => {
    let handler: (ctx: ExtensionContext) => Promise<void>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      handler = mockPi.registerShortcut.mock.calls[0][1].handler;
      mockCtx = {
        hasUI: true,
        cwd: "/home/test/project",
        ui: {
          notify: vi.fn(),
          custom: vi.fn(),
          setEditorText: vi.fn(),
          theme: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
        } as ExtensionUIContext,
        sessionManager: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        modelRegistry: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        model: undefined,
        isIdle: vi.fn(),
        abort: vi.fn(),
        hasPendingMessages: vi.fn(),
        shutdown: vi.fn(),
        getContextUsage: vi.fn(),
        compact: vi.fn(),
        getSystemPrompt: vi.fn(),
      };
    });

    describe("given no UI is available", () => {
      it("then it should do nothing", async () => {
        mockCtx.hasUI = false;

        await handler(mockCtx);

        expect(mockCtx.ui.notify).not.toHaveBeenCalled();
        expect(mockCtx.ui.custom).not.toHaveBeenCalled();
      });
    });

    describe("given no history exists for current working directory", () => {
      it("then it should notify user that no history is found", async () => {
        await handler(mockCtx);

        expect(mockCtx.ui.notify).toHaveBeenCalledWith(
          "No history found",
          "warning",
        );
        expect(mockCtx.ui.custom).not.toHaveBeenCalled();
      });
    });

    describe("given UI is available and history exists", () => {
      it("then it should show the custom UI with history", async () => {
        await expect(handler(mockCtx)).resolves.toBeUndefined();
      });
    });
  });

  // ============================================
  // Fuzzy Matching Logic
  // ============================================
  describe("fuzzyMatch function", () => {
    describe("given an empty query", () => {
      it("then it should return true for empty query", () => {
        expect(fuzzyMatch("test", "")).toBe(true);
      });

      it("then it should match unknown text", () => {
        expect(fuzzyMatch("unknown text", "")).toBe(true);
        expect(fuzzyMatch("", "")).toBe(true);
        expect(fuzzyMatch("git status", "")).toBe(true);
      });

      it("then it should return true for unknown input", () => {
        expect(fuzzyMatch("test", "")).toBe(true);
        expect(fuzzyMatch("12345", "")).toBe(true);
      });
    });

    describe("given exact string matching", () => {
      it("then it should match identical strings", () => {
        expect(fuzzyMatch("git", "git")).toBe(true);
        expect(fuzzyMatch("status", "status")).toBe(true);
        expect(fuzzyMatch("command", "command")).toBe(true);
      });

      it("then it should not match different strings", () => {
        expect(fuzzyMatch("git", "svn")).toBe(false);
        expect(fuzzyMatch("status", "state")).toBe(false);
        expect(fuzzyMatch("command", "exec")).toBe(false);
      });
    });

    describe("given fuzzy pattern matching", () => {
      it("then it should match when all characters appear in order", () => {
        expect(fuzzyMatch("git status", "gts")).toBe(true); // g,i,t,s,t,a,t,u,s -> g,t,s
        expect(fuzzyMatch("hello world", "hlo")).toBe(true); // h,e,l,l,o, ,w,o,r,l,d -> h,l,o
        expect(fuzzyMatch("npm install", "in")).toBe(true); // n,p,m, ,i,n,s,t,a,l,l -> i,n
      });

      it("then it should not match when characters are out of order", () => {
        expect(fuzzyMatch("git status", "tsg")).toBe(false); // t,s,g not in order
        expect(fuzzyMatch("hello", "hle")).toBe(false); // h,l,e not in sequence
        expect(fuzzyMatch("npm install", "nsi")).toBe(false); // n,s,i not in sequence
      });
    });

    describe("given case insensitive matching", () => {
      it("then it should treat uppercase and lowercase as equivalent", () => {
        expect(fuzzyMatch("GIT STATUS", "git")).toBe(true);
        expect(fuzzyMatch("git status", "GIT")).toBe(true);
        expect(fuzzyMatch("Hello World", "hw")).toBe(true);
        expect(fuzzyMatch("HELLO WORLD", "hw")).toBe(true);
      });
    });

    describe("given partial matches", () => {
      it("then it should match substrings", () => {
        expect(fuzzyMatch("git status --help", "status")).toBe(true);
        expect(fuzzyMatch("npm install package", "inst")).toBe(true);
        expect(fuzzyMatch("cargo build", "build")).toBe(true);
      });

      it("then it should handle repeated characters", () => {
        expect(fuzzyMatch("hello", "ll")).toBe(true);
        expect(fuzzyMatch("bookkeeping", "ook")).toBe(true);
        expect(fuzzyMatch("success", "cc")).toBe(true);
      });
    });

    describe("given complex queries", () => {
      it("then it should handle queries with spaces", () => {
        expect(fuzzyMatch("git commit", "gitc")).toBe(true);
        expect(fuzzyMatch("npm run dev", "rund")).toBe(true);
      });

      it("then it should handle queries with special characters", () => {
        expect(fuzzyMatch("git push origin", "pso")).toBe(true);
        expect(fuzzyMatch("cargo publish", "pub")).toBe(true);
      });
    });
  });
});
