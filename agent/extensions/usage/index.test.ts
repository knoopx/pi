import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMockExtensionAPI } from "../../shared/testing/test-factories";
import type { MockExtensionAPI } from "../../shared/testing/test-factories";

describe("usage extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(async () => {
    vi.resetModules();
    mockPi = createMockExtensionAPI();
    const mod = await import("./index");
    (mod.default as (pi: ExtensionAPI) => void)(
      mockPi as unknown as ExtensionAPI,
    );
  });

  it("registers the tool-usage command", () => {
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "tool-usage",
      expect.any(Object),
    );
  });

  it("registers the usage command", () => {
    const calls = mockPi.registerCommand.mock.calls as [string, unknown][];
    expect(calls.some((c) => c[0] === "usage")).toBe(true);
  });
});
