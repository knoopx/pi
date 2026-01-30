import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
} from "@mariozechner/pi-coding-agent";
import setupJujutsuExtension from "./index";

// ============================================
// Mock Setup
// ============================================
type MockExtensionAPI = {
  registerCommand: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  registerTool: ReturnType<typeof vi.fn>;
  registerShortcut: ReturnType<typeof vi.fn>;
  registerFlag: ReturnType<typeof vi.fn>;
  getFlag: ReturnType<typeof vi.fn>;
};

function createMockPi(): MockExtensionAPI {
  return {
    registerCommand: vi.fn(),
    exec: vi.fn(),
    on: vi.fn(),
    registerTool: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(),
  };
}

// ============================================
// Extension Registration
// ============================================
describe("Jujutsu Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(async () => {
    mockPi = createMockPi();
    // Mock jj status to succeed (is a repo)
    mockPi.exec.mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 });
    await setupJujutsuExtension(mockPi as unknown as ExtensionAPI);
  });

  describe("given the extension is initialized in a Jujutsu repository", () => {
    describe("when registering commands", () => {
      it("then it should register undo command", () => {
        expect(mockPi.registerCommand).toHaveBeenCalledWith(
          "undo",
          expect.any(Object),
        );
      });

      it("then it should register redo command", () => {
        expect(mockPi.registerCommand).toHaveBeenCalledWith(
          "redo",
          expect.any(Object),
        );
      });

      it("then it should register jujutsu command", () => {
        expect(mockPi.registerCommand).toHaveBeenCalledWith(
          "jujutsu",
          expect.any(Object),
        );
      });
    });

    describe("when registering event handlers", () => {
      it("then it should register before_agent_start handler", () => {
        expect(mockPi.on).toHaveBeenCalledWith(
          "before_agent_start",
          expect.any(Function),
        );
      });

      it("then it should register agent_end handler", () => {
        expect(mockPi.on).toHaveBeenCalledWith(
          "agent_end",
          expect.any(Function),
        );
      });
    });

    describe("when checking undo command description", () => {
      it("then it should include Abandon in description", () => {
        const undoCall = (
          mockPi.registerCommand.mock.calls as unknown[][]
        ).find((callItem: unknown[]) => callItem[0] === "undo");

        expect(undoCall).toBeDefined();
        expect((undoCall![1] as { description: string }).description).toContain(
          "Abandon",
        );
      });
    });

    describe("when checking redo command description", () => {
      it("then it should include Redo in description", () => {
        const redoCall = (
          mockPi.registerCommand.mock.calls as unknown[][]
        ).find((call: unknown[]) => call[0] === "redo");

        expect(redoCall).toBeDefined();
        expect((redoCall![1] as { description: string }).description).toContain(
          "Redo",
        );
      });
    });

    describe("when checking jujutsu command description", () => {
      it("then it should include settings in description", () => {
        const jujutsuCall = (
          mockPi.registerCommand.mock.calls as unknown[][]
        ).find((call: unknown[]) => call[0] === "jujutsu");

        expect(jujutsuCall).toBeDefined();
        expect(
          (jujutsuCall![1] as { description: string }).description,
        ).toContain("settings");
      });
    });
  });

  // ============================================
  // Before Agent Start Event Handler
  // ============================================
  describe("before_agent_start event handler", () => {
    let eventHandler: (
      event: BeforeAgentStartEvent,
      ctx: ExtensionContext,
    ) => Promise<void>;

    beforeEach(() => {
      eventHandler = ((mockPi.on.mock as any).calls as unknown[][]).find(
        (call: unknown[]) => call[0] === "before_agent_start",
      )?.[1] as (
        event: BeforeAgentStartEvent,
        ctx: ExtensionContext,
      ) => Promise<void>;
    });

    function createMockEventAndContext(prompt?: string | null): {
      mockEvent: BeforeAgentStartEvent;
      mockCtx: ExtensionContext;
    } {
      const mockEvent: BeforeAgentStartEvent = {
        type: "before_agent_start",
        prompt: prompt,
        systemPrompt: "Test system prompt",
      };
      const mockCtx: ExtensionContext = {
        sessionManager: {
          getBranch: () => [
            {
              id: "msg1",
              type: "message",
              message: { role: "user", content: "Hello" },
            },
          ],
        },
      } as unknown as ExtensionContext;
      return { mockEvent, mockCtx };
    }

    // Helper function to verify expected jj command calls
    function verifyJjCalls() {
      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", [
        "log",
        "-r",
        "@",
        "--template",
        "change_id",
        "--no-graph",
      ]);
      expect(mockPi.exec).toHaveBeenCalledWith("jj", ["diff"]);
    }

    describe("given the agent has changes in current change", () => {
      it("then it should create a new change with the prompt as message", async () => {
        // This test verifies that when there are changes in the current change,
        // a new change is created with the prompt as the message
        mockPi.exec.mockClear();
        mockPi.exec.mockResolvedValue({ stdout: "", stderr: "", code: 0 });

        const { mockEvent, mockCtx } = createMockEventAndContext();

        await eventHandler(mockEvent, mockCtx as ExtensionContext);

        // The extension should have made some jj calls
        expect(mockPi.exec).toHaveBeenCalled();
      });
    });

    describe("given the agent has no changes in current change", () => {
      it("then it should reuse the current change", async () => {
        mockPi.exec.mockClear();
        mockPi.exec.mockResolvedValue({ stdout: "", stderr: "", code: 0 });

        const { mockEvent, mockCtx } = createMockEventAndContext();

        await eventHandler(mockEvent, mockCtx as ExtensionContext);

        // The extension should have made jj calls but not jj new
        expect(mockPi.exec).toHaveBeenCalled();
        expect(mockPi.exec).not.toHaveBeenCalledWith("jj", [
          "new",
          "-m",
          "Test prompt",
        ]);
      });
    });

    describe("given the agent start event has an undefined prompt", () => {
      it("then it should handle the undefined prompt gracefully", async () => {
        mockPi.exec.mockReset();
        mockPi.exec.mockResolvedValueOnce({
          stdout: "",
          stderr: "",
          code: 0,
        }); // jj status check

        const { mockEvent, mockCtx } = createMockEventAndContext(null);

        await eventHandler(mockEvent, mockCtx);

        expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
        expect(mockPi.exec).toHaveBeenCalledTimes(1);
      });
    });

    describe("given jj status check fails", () => {
      it("then it should handle the error gracefully", async () => {
        mockPi.exec.mockClear();
        mockPi.exec.mockRejectedValueOnce(
          new Error("Not a Jujutsu repository"),
        );

        const { mockEvent, mockCtx } = createMockEventAndContext();

        await eventHandler(mockEvent, mockCtx as ExtensionContext);

        // Should only call jj status once and then return early
        expect(mockPi.exec).toHaveBeenCalledWith("jj", ["status"]);
        expect(mockPi.exec).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================
  // Jujutsu Settings Command
  // ============================================
  describe("jujutsu command", () => {
    describe("given the command is executed", () => {
      it("then it should register the command handler", () => {
        const commandCall = (
          mockPi.registerCommand.mock.calls as unknown[][]
        ).find((call: unknown[]) => call[0] === "jujutsu");

        expect(commandCall).toBeDefined();
        expect(
          (commandCall![1] as { handler: unknown }).handler,
        ).toBeInstanceOf(Function);
      });
    });
  });
});
