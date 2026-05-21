import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import setupExtension from "./index";

const mockOn = vi.fn();
const mockSendMessage = vi.fn();
const mockNotify = vi.fn();

function createMockPi() {
  return { on: mockOn, sendMessage: mockSendMessage };
}

type InputHandler = (
  event: { text: string; source: string },
  ctx: ExtensionContext,
) => Promise<{ action: string; text?: string }>;

function createMockContext(): ExtensionContext {
  return {
    cwd: "/tmp",
    ui: { notify: mockNotify },
  } as unknown as ExtensionContext;
}

function getInputHandler(): InputHandler | undefined {
  const calls = mockOn.mock.calls as [
    string,
    (...args: unknown[]) => unknown,
  ][];
  return (calls.find(([name]) => name === "input")?.[1] ?? undefined) as
    | InputHandler
    | undefined;
}

// Shared helper for glob pattern injection tests.
async function assertGlobInjected(
  inputText: string,
  ctx: ExtensionContext = createMockContext(),
) {
  setupExtension(createMockPi() as unknown as ExtensionAPI);
  const handler = getInputHandler();
  expect(handler).toBeDefined();

  const result = await handler!({ text: inputText, source: "user" }, ctx);

  expect(result.action).toBe("continue");
  expect(mockSendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      customType: "path-tree",
      content: expect.stringContaining("Glob:"),
      display: true,
    }),
  );
}

describe("path-injection extension", () => {
  beforeEach(() => {
    mockOn.mockReset();
    mockSendMessage.mockReset();
  });

  describe("input handler registration", () => {
    it("registers an input event handler", () => {
      setupExtension(createMockPi() as unknown as ExtensionAPI);
      expect(mockOn).toHaveBeenCalledWith("input", expect.any(Function));
    });
  });

  describe("input handler behavior", () => {
    it("skips extension-sourced input", async () => {
      setupExtension(createMockPi() as unknown as ExtensionAPI);
      const handler = getInputHandler();
      expect(handler).toBeDefined();

      const result = await handler!(
        { text: "test", source: "extension" },
        {} as ExtensionContext,
      );
      expect(result).toEqual({ action: "continue" });
    });

    it("returns continue when no glob patterns are detected", async () => {
      setupExtension(createMockPi() as unknown as ExtensionAPI);
      const handler = getInputHandler();

      const result = await handler!(
        { text: "Hello, how are you?", source: "user" },
        { cwd: "/tmp" } as ExtensionContext,
      );
      expect(result).toEqual({ action: "continue" });
    });

    it("returns continue for plain directory paths without glob characters", async () => {
      setupExtension(createMockPi() as unknown as ExtensionAPI);
      const handler = getInputHandler();

      const result = await handler!(
        { text: "Check /usr/bin please", source: "user" },
        { cwd: "/tmp" } as ExtensionContext,
      );
      expect(result).toEqual({ action: "continue" });
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("sends tree output via sendMessage for glob patterns", async () => {
      await assertGlobInjected("Check /usr/bin/* please");
    });

    it("handles multiple glob patterns", async () => {
      await assertGlobInjected("Check /usr/bin/* and /usr/share/*");
    });

    it("handles glob patterns with **", async () => {
      await assertGlobInjected("Check agent/**/index.ts", {
        cwd: "/home/knoopx/Projects/knoopx/pi",
        ui: { notify: mockNotify },
      } as unknown as ExtensionContext);
    });
  });
});
