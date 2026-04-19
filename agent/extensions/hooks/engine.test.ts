import { describe, it, expect } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { runEngineHooks } from "./engine";

function createMockPi(): ExtensionAPI {
  return {
    exec: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }),
    sendMessage: () => {},
  } as unknown as ExtensionAPI;
}

function createMockCtx(cwd: string): ExtensionContext {
  return { cwd, hasUI: false, abort: () => {} } as unknown as ExtensionContext;
}

describe("processHooks", () => {
  describe("given empty config", () => {
    it("then returns undefined without executing anything", async () => {
      const result = await runEngineHooks(createMockPi(), [], {
        event: "session_start",
        ctx: createMockCtx("/test"),
      });

      expect(result).toBeUndefined();
    });
  });

  describe("given group with non-matching pattern", () => {
    it("then skips groups that are inactive", async () => {
      let sendMessageCalled = false;
      const pi = createMockPi() as ExtensionAPI & {
        sendMessage: () => void;
      };
      pi.sendMessage = () => {
        sendMessageCalled = true;
      };

      await runEngineHooks(
        pi,
        [
          {
            group: "test",
            pattern: "nonexistent-dir-xyz/",
            hooks: [
              {
                event: "session_start",
                command: "echo test",
              },
            ],
          },
        ],
        {
          event: "session_start",
          ctx: createMockCtx("/test"),
        },
      );

      expect(sendMessageCalled).toBe(false);
    });
  });
});
