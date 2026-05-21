import { describe, it, expect } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createMockContext,
  createMockPi,
} from "../../../shared/testing/test-factories";
import { runEngineHooks } from "./hook-execution";

describe("processHooks", () => {
  describe("given empty config", () => {
    it("then returns undefined without executing anything", async () => {
      const result = await runEngineHooks(
        createMockPi() as unknown as ExtensionAPI,
        [],
        {
          event: "session_start",
          ctx: createMockContext({ cwd: "/test", hasUI: false }),
        },
      );

      expect(result).toBeUndefined();
    });
  });

  describe("given group with non-matching pattern", () => {
    it("then skips groups that are inactive", async () => {
      let sendMessageCalled = false;
      const pi = createMockPi() as unknown as ExtensionAPI & {
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
          ctx: createMockContext({ cwd: "/test", hasUI: false }),
        },
      );

      expect(sendMessageCalled).toBe(false);
    });
  });
});
