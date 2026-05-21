import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMockExtensionAPI } from "../../shared/testing/test-factories";
import type { MockExtensionAPI } from "../../shared/testing/test-factories";

describe("hooks extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("./config/loader", () => ({
      configLoader: {
        load: vi.fn(),
        getConfig: vi.fn().mockReturnValue([]),
      },
      loadHooksSettings: vi.fn().mockResolvedValue({ enabled: true }),
    }));
    mockPi = createMockExtensionAPI();
    const mod = await import("./index");
    await (mod.default as (pi: ExtensionAPI) => Promise<void>)(
      mockPi as unknown as ExtensionAPI,
    );
  });

  it("registers event handlers", () => {
    const calls = mockPi.on.mock.calls as [
      string,
      (...args: unknown[]) => void,
    ][];
    expect(calls.length).toBeGreaterThan(0);
  });

  it("registers commands", () => {
    expect(mockPi.registerCommand).toHaveBeenCalled();
  });
});
