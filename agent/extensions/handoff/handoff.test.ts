import { describe, it, expect, beforeEach, vi } from "vitest";
import setupHandoffExtension from "./index";

describe("Handoff Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerCommand: vi.fn(),
    };
    setupHandoffExtension(mockPi);
  });

  it("should register handoff command", () => {
    expect(mockPi.registerCommand).toHaveBeenCalledWith("handoff", {
      description: "Transfer context to a new focused session",
      handler: expect.any(Function),
    });
  });

  describe("handoff command handler", () => {
    let handler: any;
    let mockCtx: any;

    beforeEach(() => {
      handler = mockPi.registerCommand.mock.calls[0][1].handler;
      mockCtx = {
        hasUI: true,
        model: "test-model",
        ui: {
          notify: vi.fn(),
          custom: vi.fn(),
          editor: vi.fn(),
          setEditorText: vi.fn(),
        },
        sessionManager: {
          getBranch: vi.fn(),
          getSessionFile: vi.fn(),
        },
        modelRegistry: {
          getApiKey: vi.fn(),
        },
        newSession: vi.fn(),
      };
    });

    it("should show error if not in interactive mode", async () => {
      mockCtx.hasUI = false;

      await handler("implement feature", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "handoff requires interactive mode",
        "error",
      );
    });

    it("should show error if no model selected", async () => {
      mockCtx.model = null;

      await handler("implement feature", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No model selected",
        "error",
      );
    });

    it("should show error if no goal provided", async () => {
      await handler("", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "Usage: /handoff <goal for new thread>",
        "error",
      );
    });

    it("should show error if no conversation to hand off", async () => {
      mockCtx.sessionManager.getBranch.mockReturnValue([]);

      await handler("implement feature", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "No conversation to hand off",
        "error",
      );
    });

    it("should generate and set handoff prompt successfully", async () => {
      // Mock conversation data
      const mockMessages = [
        {
          type: "message",
          message: {
            role: "user",
            content: [{ type: "text", text: "Hello" }],
            timestamp: Date.now(),
          },
        },
      ];
      mockCtx.sessionManager.getBranch.mockReturnValue(mockMessages);
      mockCtx.sessionManager.getSessionFile.mockReturnValue("session.json");

      // Mock UI interactions
      mockCtx.ui.custom.mockResolvedValue("Generated prompt");
      mockCtx.ui.editor.mockResolvedValue("Edited prompt");
      mockCtx.newSession.mockResolvedValue({ cancelled: false });

      // Mock API call
      mockCtx.modelRegistry.getApiKey.mockResolvedValue("test-api-key");

      // Mock the complete function
      const mockComplete = vi.fn();
      mockComplete.mockResolvedValue({
        content: [{ type: "text", text: "Generated handoff prompt" }],
        stopReason: "completed",
      });

      // Import and mock the complete function
      vi.doMock("@mariozechner/pi-ai", () => ({
        complete: mockComplete,
      }));

      await handler("implement feature", mockCtx);

      expect(mockCtx.ui.custom).toHaveBeenCalled();
      expect(mockCtx.ui.editor).toHaveBeenCalledWith(
        "Edit handoff prompt",
        "Generated prompt",
      );
      expect(mockCtx.newSession).toHaveBeenCalledWith({
        parentSession: "session.json",
      });
      expect(mockCtx.ui.setEditorText).toHaveBeenCalledWith("Edited prompt");
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "Handoff ready. Submit when ready.",
        "info",
      );
    });

    it("should handle cancellation during prompt generation", async () => {
      const mockMessages = [
        {
          type: "message",
          message: {
            role: "user",
            content: [{ type: "text", text: "Hello" }],
            timestamp: Date.now(),
          },
        },
      ];
      mockCtx.sessionManager.getBranch.mockReturnValue(mockMessages);

      mockCtx.ui.custom.mockResolvedValue(null);

      await handler("implement feature", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Cancelled", "info");
    });

    it("should handle cancellation during prompt editing", async () => {
      const mockMessages = [
        {
          type: "message",
          message: {
            role: "user",
            content: [{ type: "text", text: "Hello" }],
            timestamp: Date.now(),
          },
        },
      ];
      mockCtx.sessionManager.getBranch.mockReturnValue(mockMessages);

      mockCtx.ui.custom.mockResolvedValue("Generated prompt");
      mockCtx.ui.editor.mockResolvedValue(undefined);

      await handler("implement feature", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith("Cancelled", "info");
    });

    it("should handle cancellation during new session creation", async () => {
      const mockMessages = [
        {
          type: "message",
          message: {
            role: "user",
            content: [{ type: "text", text: "Hello" }],
            timestamp: Date.now(),
          },
        },
      ];
      mockCtx.sessionManager.getBranch.mockReturnValue(mockMessages);

      mockCtx.ui.custom.mockResolvedValue("Generated prompt");
      mockCtx.ui.editor.mockResolvedValue("Edited prompt");
      mockCtx.newSession.mockResolvedValue({ cancelled: true });

      await handler("implement feature", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "New session cancelled",
        "info",
      );
    });
  });
});
