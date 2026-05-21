import { describe, it, expect, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommands } from "./register";
import { createMockExtensionAPI } from "../../../shared/testing/test-factories";
import type { MockExtensionAPI } from "../../../shared/testing/test-factories";

describe("registerCommands", () => {
  let mockPi: MockExtensionAPI;
  let hooksEnabledRef: { value: boolean };

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    hooksEnabledRef = { value: true };
    registerCommands(mockPi as unknown as ExtensionAPI, hooksEnabledRef);
  });

  it("registers the /hooks command", () => {
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      "hooks",
      expect.objectContaining({
        description: expect.stringContaining("Toggle"),
      }),
    );
  });

  it("registers at least one command", () => {
    expect(mockPi.registerCommand.mock.calls.length).toBeGreaterThan(0);
  });
});
