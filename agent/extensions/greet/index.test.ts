import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";
import createGreetingExtension from "./index";

describe("Greet Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("given the extension is initialized", () => {
    beforeEach(() => {
      createGreetingExtension(mockPi as unknown as ExtensionAPI);
    });

    it("then it should register a session_start event handler", () => {
      expect(mockPi.on).toHaveBeenCalledWith(
        "session_start",
        expect.any(Function),
      );
    });

    it("then only one event handler should be registered", () => {
      const sessionStartCalls = mockPi.on.mock.calls.filter(
        (call) => call[0] === "session_start",
      );
      expect(sessionStartCalls).toHaveLength(1);
    });
  });

  describe("given session_start event is triggered", () => {
    describe("when GREET.md exists", () => {
      it("then it should send user message to read GREET.md", async () => {
        // Mock fs/promises.access to succeed (file exists)
        vi.doMock("fs/promises", () => ({
          access: vi.fn().mockResolvedValue(undefined),
        }));

        // Re-import to get fresh module with mocks
        const { default: createGreetingExtensionFresh } =
          await import("./index");
        const freshMockPi = createMockExtensionAPI();
        createGreetingExtensionFresh(freshMockPi as unknown as ExtensionAPI);

        const handler = freshMockPi.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];
        expect(handler).toBeDefined();

        await handler({}, {});

        expect(freshMockPi.sendUserMessage).toHaveBeenCalledWith(
          "Read .pi/GREET.md",
        );
      });
    });

    describe("when GREET.md does not exist", () => {
      it("then it should not send any message", async () => {
        // Mock fs/promises.access to fail (file doesn't exist)
        vi.doMock("fs/promises", () => ({
          access: vi.fn().mockRejectedValue(new Error("ENOENT")),
        }));

        // Re-import to get fresh module with mocks
        const { default: createGreetingExtensionFresh } =
          await import("./index");
        const freshMockPi = createMockExtensionAPI();
        createGreetingExtensionFresh(freshMockPi as unknown as ExtensionAPI);

        const handler = freshMockPi.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];
        expect(handler).toBeDefined();

        await handler({}, {});

        expect(freshMockPi.sendUserMessage).not.toHaveBeenCalled();
      });
    });

    describe("when fs/promises import fails", () => {
      it("then it should not throw and not send any message", async () => {
        createGreetingExtension(mockPi as unknown as ExtensionAPI);

        const handler = mockPi.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];
        expect(handler).toBeDefined();

        // The handler should not throw even if something goes wrong internally
        await expect(handler({}, {})).resolves.not.toThrow();
      });
    });
  });
});
