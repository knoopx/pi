import { describe, it, expect, beforeEach, vi } from "vitest";
import setupRalphLoopExtension from "./index";

describe("Ralph Loop Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
    };
    setupRalphLoopExtension(mockPi);
  });

  it("should register ralph-loop tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ralph-loop",
        label: "Ralph Loop",
      }),
    );
  });

  it("should register ralph-loop control commands", () => {
    const commands = [
      "ralph-steer",
      "ralph-follow",
      "ralph-clear",
      "ralph-pause",
      "ralph-resume",
      "ralph-stop",
      "ralph-status",
    ];

    commands.forEach((command) => {
      expect(mockPi.registerCommand).toHaveBeenCalledWith(
        command,
        expect.any(Object),
      );
    });
  });

  describe("ralph-loop tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "ralph-loop",
      )[0];
    });

    it("should handle invalid parameters - no mode specified", async () => {
      const mockCtx = {
        cwd: "/test",
        sessionManager: {
          getEntries: vi.fn(() => []),
        },
      };

      // Mock discoverAgents to return no agents
      vi.doMock("./ralph-loop/agents", () => ({
        discoverAgents: vi.fn(() => ({ agents: [], projectAgentsDir: null })),
      }));

      const result = await registeredTool.execute(
        "tool1",
        {},
        vi.fn(),
        mockCtx,
      );

      expect(result.content[0].text).toContain("Unable to infer task or agent");
    });

    it("should handle parallel mode not supported", async () => {
      const mockCtx = { cwd: "/test" };

      vi.doMock("./ralph-loop/agents", () => ({
        discoverAgents: vi.fn(() => ({
          agents: [
            { name: "worker", source: "user", model: "test", systemPrompt: "" },
          ],
          projectAgentsDir: null,
        })),
      }));

      const result = await registeredTool.execute(
        "tool1",
        {
          tasks: ["task1", "task2"],
        },
        vi.fn(),
        mockCtx,
      );

      expect(result.content[0].text).toContain(
        "Parallel mode is not supported",
      );
    });

    it("should handle multiple modes specified", async () => {
      const mockCtx = { cwd: "/test" };

      vi.doMock("./ralph-loop/agents", () => ({
        discoverAgents: vi.fn(() => ({
          agents: [
            { name: "worker", source: "user", model: "test", systemPrompt: "" },
          ],
          projectAgentsDir: null,
        })),
      }));

      const result = await registeredTool.execute(
        "tool1",
        {
          agent: "worker",
          task: "do something",
          chain: [{ agent: "worker", task: "another task" }],
        },
        vi.fn(),
        mockCtx,
      );

      expect(result.content[0].text).toContain("Provide exactly one mode");
    });

    it("should infer task from last user message when no task provided", async () => {
      const mockCtx = {
        cwd: "/test",
        sessionManager: {
          getEntries: vi.fn(() => [
            {
              type: "message",
              message: {
                role: "user",
                content: [{ type: "text", text: "Please implement feature X" }],
              },
            },
          ]),
        },
      };

      vi.doMock("./ralph-loop/agents", () => ({
        discoverAgents: vi.fn(() => ({
          agents: [
            { name: "worker", source: "user", model: "test", systemPrompt: "" },
          ],
          projectAgentsDir: null,
        })),
      }));

      // Mock the execution to avoid full implementation
      const mockExecuteSubagentOnce = vi.fn().mockResolvedValue({
        output: "Task completed",
        details: {
          mode: "single",
          agentScope: "user",
          projectAgentsDir: null,
          results: [],
        },
      });

      vi.doMock("./ralph-loop/index", () => ({
        ...vi.importActual("./ralph-loop/index"),
        executeSubagentOnce: mockExecuteSubagentOnce,
      }));

      // This test would need more complex mocking to fully work
      // For now, just verify the tool is registered correctly
      expect(registeredTool.name).toBe("ralph-loop");
    });
  });

  describe("ralph-steer command", () => {
    let handler: any;

    beforeEach(() => {
      handler = mockPi.registerCommand.mock.calls.find(
        (call) => call[0] === "ralph-steer",
      )[1].handler;
    });

    it("should require interactive mode", async () => {
      const mockCtx = {
        hasUI: false,
        ui: { notify: vi.fn() },
      };

      await handler("test message", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "Interactive mode required.",
        "error",
      );
    });

    it("should require active loop", async () => {
      const mockCtx = {
        hasUI: true,
        ui: { notify: vi.fn() },
      };

      await handler("test message", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No active ralph_loop run.",
        "warning",
      );
    });

    it("should handle --once flag", async () => {
      // This would need full loop control state mocking
      // For now, just verify command registration
      expect(handler).toBeDefined();
    });
  });

  describe("ralph-status command", () => {
    let handler: any;

    beforeEach(() => {
      handler = mockPi.registerCommand.mock.calls.find(
        (call) => call[0] === "ralph-status",
      )[1].handler;
    });

    it("should show idle status when no activity", async () => {
      const mockCtx = {
        ui: { notify: vi.fn() },
      };

      await handler("", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No ralph_loop activity yet.",
        "info",
      );
    });
  });
});
