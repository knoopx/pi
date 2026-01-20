import { describe, it, expect, beforeEach, vi } from "vitest";
import setupInitExtension from "./index";

describe("Scenario: Init Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerCommand: vi.fn(),
      sendUserMessage: vi.fn(),
    };
    setupInitExtension(mockPi);
  });

  it("should register init command", () => {
    expect(mockPi.registerCommand).toHaveBeenCalledWith("init", {
      description: "Analyze codebase and create/improve AGENTS.md",
      handler: expect.any(Function),
    });
  });

  describe("Given init command handler", () => {
    let handler: any;
    let mockCtx: any;

    beforeEach(() => {
      handler = mockPi.registerCommand.mock.calls[0][1].handler;
      mockCtx = {
        cwd: "/test/project",
        hasUI: true,
        ui: {
          notify: vi.fn(),
        },
        waitForIdle: vi.fn(),
      };
    });

    it("should send user message with template prompt", async () => {
      mockCtx.waitForIdle.mockResolvedValue();

      await handler("additional arguments", mockCtx);

      expect(mockCtx.waitForIdle).toHaveBeenCalledTimes(2);
      expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining(
          "Please analyze this codebase and create an AGENTS.md file",
        ),
      );
      expect(mockPi.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining("additional arguments"),
      );
      expect(mockCtx.waitForIdle).toHaveBeenCalledTimes(2);
    });

    it("should replace path placeholder with current working directory", async () => {
      mockCtx.waitForIdle.mockResolvedValue();

      await handler("", mockCtx);

      const sentMessage = mockPi.sendUserMessage.mock.calls[0][0];
      expect(sentMessage).toContain("/test/project");
    });

    it("should handle empty arguments", async () => {
      mockCtx.waitForIdle.mockResolvedValue();

      await handler("", mockCtx);

      const sentMessage = mockPi.sendUserMessage.mock.calls[0][0];
      expect(sentMessage).not.toContain("additional arguments");
    });

    it("should notify user when in interactive mode", async () => {
      mockCtx.hasUI = true;
      mockCtx.waitForIdle.mockResolvedValue();

      await handler("", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "Analyzing codebase and initializing AGENTS.md...",
        "info",
      );
    });

    it("should not notify user when not in interactive mode", async () => {
      mockCtx.hasUI = false;
      mockCtx.waitForIdle.mockResolvedValue();

      await handler("", mockCtx);

      expect(mockCtx.ui.notify).not.toHaveBeenCalled();
    });
  });
});
