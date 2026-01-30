import { describe, it, expect, beforeEach, vi } from "vitest";
import setupBookmarksExtension from "./index";
import { getFirefoxProfilePath } from "./index";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ============================================
// Extension Registration
// ============================================
describe("Bookmarks Extension", () => {
  let mockPi: ExtensionAPI;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
    } as unknown as ExtensionAPI;
    setupBookmarksExtension(mockPi);
  });

  describe("given the extension is initialized", () => {
    describe("when registering tools", () => {
      it("then it should register list-firefox-profiles tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "list-firefox-profiles",
          }),
        );
      });

      it("then it should register search-bookmarks tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "search-bookmarks",
          }),
        );
      });

      it("then it should register search-bookmarks-by-similarity tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "search-bookmarks-by-similarity",
          }),
        );
      });

      it("then it should register get-bookmark tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "get-bookmark",
          }),
        );
      });
    });
  });
});

// ============================================
// Firefox Profile Path
// ============================================
describe("getFirefoxProfilePath", () => {
  it("then it should return the default profile path", () => {
    const result = getFirefoxProfilePath();
    expect(result).toBeDefined();
    expect(result).toContain(".mozilla/firefox");
  });

  it("then it should accept a profile name parameter", () => {
    const result = getFirefoxProfilePath("default");
    expect(result).toBeDefined();
    expect(result).toContain(".mozilla/firefox");
  });
});

// ============================================
// Bookmark Hierarchy
// ============================================
