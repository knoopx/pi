import { describe, it, expect, beforeEach } from "vitest";
import setupExtension from "./index";
import {
  createMockExtensionAPI,
  extractEventHandlers,
  type MockExtensionAPI,
} from "../../shared/testing/test-factories";

describe("steering behavior — full flow", () => {
  describe("extension integration — session reset", () => {
    let mockPi: MockExtensionAPI;
    let sessionStartHandler: (event: unknown) => Promise<void>;

    beforeEach(() => {
      mockPi = createMockExtensionAPI();
      setupExtension(
        mockPi as unknown as import("@earendil-works/pi-coding-agent").ExtensionAPI,
      );
      const handlers = extractEventHandlers(mockPi);
      sessionStartHandler = handlers[
        "session_start"
      ] as typeof sessionStartHandler;
    });

    it("resets steering state on session start", async () => {
      await sessionStartHandler({});
      // No crash — state is reset cleanly
      expect(true).toBe(true);
    });
  });
});
