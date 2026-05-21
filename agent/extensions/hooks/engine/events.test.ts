import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { registerEventHandlers } from "./events";
import type { HooksConfig } from "../types/schema";
import { createMockExtensionAPI } from "../../../shared/testing/test-factories";
import type { MockExtensionAPI } from "../../../shared/testing/test-factories";

function findHandler(
  mockPi: MockExtensionAPI,
  eventName: string,
): (...args: unknown[]) => void {
  const calls = mockPi.on.mock.calls as [
    string,
    (...args: unknown[]) => void,
  ][];
  return calls.find((c) => c[0] === eventName)![1];
}

function hasHandler(mockPi: MockExtensionAPI, eventName: string): boolean {
  const calls = mockPi.on.mock.calls as [
    string,
    (...args: unknown[]) => void,
  ][];
  return calls.some((c) => c[0] === eventName);
}

describe("registerEventHandlers", () => {
  let mockPi: MockExtensionAPI;
  let getConfig: () => Promise<HooksConfig>;
  let isEnabled: () => boolean;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    getConfig = vi.fn().mockResolvedValue([]);
    isEnabled = vi.fn().mockReturnValue(true);
    registerEventHandlers(
      mockPi as unknown as ExtensionAPI,
      getConfig,
      isEnabled,
    );
  });

  it("registers session_start handler", () => {
    expect(hasHandler(mockPi, "session_start")).toBe(true);
  });

  it("registers session_shutdown handler", () => {
    expect(hasHandler(mockPi, "session_shutdown")).toBe(true);
  });

  it("registers agent_start handler", () => {
    expect(hasHandler(mockPi, "agent_start")).toBe(true);
  });

  it("registers tool_call handler", () => {
    expect(hasHandler(mockPi, "tool_call")).toBe(true);
  });

  it("registers tool_result handler", () => {
    expect(hasHandler(mockPi, "tool_result")).toBe(true);
  });

  it("registers agent_end handler", () => {
    expect(hasHandler(mockPi, "agent_end")).toBe(true);
  });

  it("registers turn_start handler", () => {
    expect(hasHandler(mockPi, "turn_start")).toBe(true);
  });

  it("registers turn_end handler", () => {
    expect(hasHandler(mockPi, "turn_end")).toBe(true);
  });

  describe("disabled hooks", () => {
    it("skips processing when disabled", async () => {
      (isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const turnStartHandler = findHandler(mockPi, "turn_start");

      const ctx = { hasUI: true, cwd: "/test" } as ExtensionContext;
      await turnStartHandler({}, ctx);

      expect(getConfig).not.toHaveBeenCalled();
    });
  });
});
