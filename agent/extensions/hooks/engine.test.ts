import { describe, it, expect } from "vitest";
import { processHooks } from "./engine";

describe("processHooks", () => {
  describe("given empty config", () => {
    it("then returns undefined without executing anything", async () => {
      const pi = {
        exec: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }),
        sendMessage: () => {},
      } as any;

      const result = await processHooks(pi, [], {
        event: "session_start",
        ctx: { cwd: "/test" } as any,
      });

      expect(result).toBeUndefined();
    });
  });

  describe("given group with non-matching pattern", () => {
    it("then skips groups that are inactive", async () => {
      let sendMessageCalled = false;
      const pi = {
        exec: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }),
        sendMessage: () => {
          sendMessageCalled = true;
        },
      } as any;

      await processHooks(
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
          ctx: { cwd: "/test" } as any,
        },
      );

      expect(sendMessageCalled).toBe(false);
    });
  });
});
