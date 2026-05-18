import { describe, beforeEach, afterEach } from "vitest";
import type { MockExtensionAPI } from "../../../shared/testing/test-utils";
import { createMockExtensionAPI } from "../../../shared/testing/test-utils";
import { disableThrottle } from "../../../shared/network/throttle";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import websearchExtension from "../index";

export function setupWebsearchTest(
  name: string,
  fn: (ctx: { mockPi: MockExtensionAPI }) => void,
) {
  const ctx: { mockPi: MockExtensionAPI } = {
    mockPi: undefined as unknown as MockExtensionAPI,
  };
  let originalFetch: typeof globalThis.fetch;

  describe(name, () => {
    beforeEach(() => {
      disableThrottle();
      ctx.mockPi = createMockExtensionAPI();
      originalFetch = globalThis.fetch;
      websearchExtension(ctx.mockPi as ExtensionAPI);
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    fn(ctx);
  });
}
