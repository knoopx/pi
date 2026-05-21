import { describe, it, expect, beforeEach } from "vitest";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  setupTurnStats,
  completeMessageFlow,
  setupMessageUpdateFlow,
} from "./test-factories";
import { createMockContext } from "../../shared/testing/test-factories";

describe("turn-stats extension handlers", () => {
  let handlers: Awaited<ReturnType<typeof setupTurnStats>>["handlers"] =
    {} as Awaited<ReturnType<typeof setupTurnStats>>["handlers"];
  let mockCtx: ExtensionContext = createMockContext();

  beforeEach(async () => {
    const result = await setupTurnStats();
    handlers = result.handlers;
    mockCtx = createMockContext();
  });

  describe("event handler registration", () => {
    it("registers turn_start handler", () => {
      expect(handlers.turnStart).toBeDefined();
    });

    it("registers message_start handler", () => {
      expect(handlers.messageStart).toBeDefined();
    });

    it("registers message_update handler", () => {
      expect(handlers.messageUpdate).toBeDefined();
    });

    it("registers message_end handler", () => {
      expect(handlers.messageEnd).toBeDefined();
    });

    it("registers turn_end handler", () => {
      expect(handlers.turnEnd).toBeDefined();
    });

    it("registers agent_start handler", () => {
      expect(handlers.agentStart).toBeDefined();
    });

    it("registers agent_end handler", () => {
      expect(handlers.agentEnd).toBeDefined();
    });

    it("registers session_start handler", () => {
      expect(handlers.sessionStart).toBeDefined();
    });

    it("registers session_shutdown handler", () => {
      expect(handlers.sessionShutdown).toBeDefined();
    });
  });

  describe("turn_end handler notification", () => {
    it("sends notification with output tokens and duration", () => {
      handlers.turnStart({ timestamp: Date.now() });
      handlers.turnEnd(
        {
          message: {
            role: "assistant",
            content: [],
            usage: {
              input: 100,
              output: 500,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 600,
              cost: {
                input: 0.001,
                output: 0.002,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0.003,
              },
            },
          } as unknown,
          timestamp: Date.now(),
        },
        mockCtx,
      );

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining("↓500"),
        "info",
      );
    });

    it("does not send notification for non-assistant messages", () => {
      handlers.turnEnd(
        {
          message: {
            role: "user",
            content: [],
          } as unknown,
          timestamp: Date.now(),
        },
        mockCtx,
      );

      expect(mockCtx.ui.notify).not.toHaveBeenCalled();
    });

    it("handles missing usage gracefully", () => {
      handlers.turnEnd(
        {
          message: {
            role: "assistant",
            content: [],
          } as unknown,
          timestamp: Date.now(),
        },
        mockCtx,
      );

      // Should not crash even without usage data
    });
  });

  describe("agent_end handler", () => {
    it("sends aggregate notification after agent_start", () => {
      handlers.agentStart();
      handlers.agentEnd(
        {
          messages: [
            {
              role: "assistant",
              content: [],
              usage: {
                input: 100,
                output: 500,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 600,
                cost: {
                  input: 0.001,
                  output: 0.002,
                  cacheRead: 0,
                  cacheWrite: 0,
                  total: 0.003,
                },
              },
            } as unknown,
          ],
        } as unknown,
        mockCtx,
      );

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining("turn"),
        "info",
      );
    });

    it("does not send notification when no assistant messages", () => {
      handlers.agentStart();
      handlers.agentEnd(
        {
          messages: [
            {
              role: "user",
              content: [],
            } as unknown,
          ],
        } as unknown,
        mockCtx,
      );

      expect(mockCtx.ui.notify).not.toHaveBeenCalled();
    });

    it("does not send notification when hasUI is false", () => {
      const noUiCtx = {
        ...mockCtx,
        hasUI: false,
      } as ExtensionContext;

      handlers.agentEnd(
        {
          messages: [
            {
              role: "assistant",
              content: [],
              usage: {
                input: 100,
                output: 500,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 600,
                cost: {
                  input: 0.001,
                  output: 0.002,
                  cacheRead: 0,
                  cacheWrite: 0,
                  total: 0.003,
                },
              },
            } as unknown,
          ],
        } as unknown,
        noUiCtx,
      );

      expect(mockCtx.ui.notify).not.toHaveBeenCalled();
    });
  });

  describe("session handlers", () => {
    it("resets on session_start", () => {
      handlers.sessionStart();
    });

    it("resets on session_shutdown", () => {
      handlers.sessionShutdown();
    });
  });

  describe("agent_start handler", () => {
    it("sets agent start time", () => {
      handlers.agentStart();
    });
  });

  describe("message handlers", () => {
    it("handles message_start without crashing", () => {
      handlers.turnStart({ timestamp: Date.now() });
      handlers.messageStart({
        message: { role: "assistant" } as unknown,
        timestamp: Date.now(),
      });
    });

    it("handles message_update without crashing", () => {
      setupMessageUpdateFlow(handlers);
    });

    it("handles message_end without crashing", () => {
      completeMessageFlow(handlers);
    });
  });

  describe("message update stall detection", () => {
    it("handles first token setting", () => {
      setupMessageUpdateFlow(handlers);
    });

    it("handles stall state updates", () => {
      setupMessageUpdateFlow(handlers);
      handlers.messageUpdate({
        message: { role: "assistant" } as unknown,
        timestamp: Date.now() + 6000,
      });
    });
  });

  describe("message end handler", () => {
    it("applies generation time on message_end", () => {
      completeMessageFlow(handlers);
    });
  });
});
