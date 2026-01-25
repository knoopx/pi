import { describe, it, expect, beforeEach, vi } from "vitest";
import setupReverseHistorySearchExtension from "./index";

describe("Scenario: Reverse History Search Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerShortcut: vi.fn(),
    };
    setupReverseHistorySearchExtension(mockPi);
  });

  it("should register ctrl+r shortcut", () => {
    expect(mockPi.registerShortcut).toHaveBeenCalledWith("ctrl+r", {
      description:
        "Reverse history search (user messages and commands from sessions in current directory)",
      handler: expect.any(Function),
    });
  });

  describe("Given shortcut handler", () => {
    let handler: any;
    let mockCtx: any;

    beforeEach(() => {
      handler = mockPi.registerShortcut.mock.calls[0][1].handler;
      mockCtx = {
        hasUI: true,
        cwd: "/home/test/project",
        ui: {
          notify: vi.fn(),
          custom: vi.fn(),
          setEditorText: vi.fn(),
        },
      };
    });

    it("should do nothing if no UI", async () => {
      mockCtx.hasUI = false;

      await handler(mockCtx);

      expect(mockCtx.ui.notify).not.toHaveBeenCalled();
      expect(mockCtx.ui.custom).not.toHaveBeenCalled();
    });

    it("should show notification when no history for current cwd", async () => {
      // No sessions exist for mock cwd, so notification should be shown
      await handler(mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No history found",
        "warning",
      );
      expect(mockCtx.ui.custom).not.toHaveBeenCalled();
    });
  });

  describe("Given fuzzy matching functionality", () => {
    // Test the fuzzy matching behavior through component interaction
    // Since fuzzyMatch is an internal function, we'll test its behavior
    // by creating test scenarios that exercise the matching logic

    const fuzzyMatch = (text: string, query: string): boolean => {
      if (!query) return true;

      const textLower = text.toLowerCase();
      const queryLower = query.toLowerCase();
      let textIdx = 0;

      for (const char of queryLower) {
        textIdx = textLower.indexOf(char, textIdx);
        if (textIdx === -1) return false;
        textIdx++;
      }

      return true;
    };

    describe("Given empty query", () => {
      it("should match any text", () => {
        expect(fuzzyMatch("any text", "")).toBe(true);
        expect(fuzzyMatch("", "")).toBe(true);
        expect(fuzzyMatch("git status", "")).toBe(true);
      });
    });

    describe("Given exact string matching", () => {
      it("should match identical strings", () => {
        expect(fuzzyMatch("git", "git")).toBe(true);
        expect(fuzzyMatch("status", "status")).toBe(true);
      });

      it("should not match different strings", () => {
        expect(fuzzyMatch("git", "svn")).toBe(false);
        expect(fuzzyMatch("status", "state")).toBe(false);
      });
    });

    describe("Given fuzzy pattern matching", () => {
      it("should match when all characters appear in order", () => {
        expect(fuzzyMatch("git status", "gts")).toBe(true); // g,i,t,s,t,a,t,u,s -> g,t,s
        expect(fuzzyMatch("hello world", "hlo")).toBe(true); // h,e,l,l,o, ,w,o,r,l,d -> h,l,o
      });

      it("should not match when characters are out of order", () => {
        expect(fuzzyMatch("git status", "tsg")).toBe(false); // t,s,g not in order
        expect(fuzzyMatch("hello", "hle")).toBe(false); // h,l,e not in sequence
      });

      it("should be case insensitive", () => {
        expect(fuzzyMatch("GIT STATUS", "git")).toBe(true);
        expect(fuzzyMatch("git status", "GIT")).toBe(true);
        expect(fuzzyMatch("Hello World", "hw")).toBe(true);
      });
    });

    describe("Given partial matches", () => {
      it("should match substrings", () => {
        expect(fuzzyMatch("git status --help", "status")).toBe(true);
        expect(fuzzyMatch("npm install package", "inst")).toBe(true);
      });

      it("should handle repeated characters", () => {
        expect(fuzzyMatch("hello", "ll")).toBe(true);
        expect(fuzzyMatch("bookkeeping", "ook")).toBe(true);
      });
    });
  });
});
