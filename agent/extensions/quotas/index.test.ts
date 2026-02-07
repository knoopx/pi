import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { MockExtensionAPI } from "../../test-utils";
import { createMockExtensionAPI } from "../../test-utils";
import quotasExtension from "./index";

// Mock the provider modules
vi.mock("./providers/anthropic", () => ({
  fetchAnthropicUsage: vi.fn(),
}));
vi.mock("./providers/openai", () => ({
  fetchOpenAIUsage: vi.fn(),
}));
vi.mock("./providers/copilot", () => ({
  fetchCopilotUsage: vi.fn(),
}));
vi.mock("./providers/gemini", () => ({
  fetchGeminiUsage: vi.fn(),
}));

describe("Quotas Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPi = createMockExtensionAPI();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("given the extension is initialized", () => {
    beforeEach(() => {
      quotasExtension(mockPi as unknown as ExtensionAPI);
    });

    it("then it should register the quotas:refresh command", () => {
      expect(mockPi.registerCommand).toHaveBeenCalledWith(
        "quotas:refresh",
        expect.objectContaining({
          description: expect.any(String),
          handler: expect.any(Function),
        }),
      );
    });

    it("then it should register session_start event handler", () => {
      expect(mockPi.on).toHaveBeenCalledWith(
        "session_start",
        expect.any(Function),
      );
    });

    it("then it should register model_select event handler", () => {
      expect(mockPi.on).toHaveBeenCalledWith(
        "model_select",
        expect.any(Function),
      );
    });
  });

  describe("given session_start event is triggered", () => {
    describe("when model is anthropic/claude", () => {
      it("then it should fetch anthropic usage", async () => {
        const { fetchAnthropicUsage } = await import("./providers/anthropic");
        vi.mocked(fetchAnthropicUsage).mockResolvedValue({
          provider: "anthropic",
          displayName: "Anthropic",
          windows: [{ label: "Daily", usedPercent: 50 }],
        });

        quotasExtension(mockPi as unknown as ExtensionAPI);

        const handler = mockPi.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];

        const mockCtx = {
          model: { provider: "anthropic", id: "claude-3" },
          ui: { setWidget: vi.fn() },
        };

        await handler({}, mockCtx);

        expect(fetchAnthropicUsage).toHaveBeenCalled();
        expect(mockCtx.ui.setWidget).toHaveBeenCalledWith(
          "quotas",
          expect.any(Function),
          expect.any(Object),
        );
      });
    });

    describe("when model is openai/gpt", () => {
      it("then it should fetch openai usage", async () => {
        const { fetchOpenAIUsage } = await import("./providers/openai");
        vi.mocked(fetchOpenAIUsage).mockResolvedValue({
          provider: "openai",
          displayName: "OpenAI",
          windows: [{ label: "Monthly", usedPercent: 25 }],
        });

        quotasExtension(mockPi as unknown as ExtensionAPI);

        const handler = mockPi.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];

        const mockCtx = {
          model: { provider: "openai", id: "gpt-4" },
          ui: { setWidget: vi.fn() },
        };

        await handler({}, mockCtx);

        expect(fetchOpenAIUsage).toHaveBeenCalled();
      });
    });

    describe("when model is github/copilot", () => {
      it("then it should fetch copilot usage", async () => {
        const { fetchCopilotUsage } = await import("./providers/copilot");
        vi.mocked(fetchCopilotUsage).mockResolvedValue({
          provider: "copilot",
          displayName: "GitHub Copilot",
          windows: [{ label: "Daily", usedPercent: 10 }],
        });

        quotasExtension(mockPi as unknown as ExtensionAPI);

        const handler = mockPi.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];

        const mockCtx = {
          model: { provider: "github", id: "copilot" },
          ui: { setWidget: vi.fn() },
        };

        await handler({}, mockCtx);

        expect(fetchCopilotUsage).toHaveBeenCalled();
      });
    });

    describe("when model is google/gemini", () => {
      it("then it should fetch gemini usage", async () => {
        const { fetchGeminiUsage } = await import("./providers/gemini");
        vi.mocked(fetchGeminiUsage).mockResolvedValue({
          provider: "gemini",
          displayName: "Google Gemini",
          windows: [{ label: "Daily", usedPercent: 5 }],
        });

        quotasExtension(mockPi as unknown as ExtensionAPI);

        const handler = mockPi.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];

        const mockCtx = {
          model: { provider: "google", id: "gemini-pro" },
          ui: { setWidget: vi.fn() },
        };

        await handler({}, mockCtx);

        expect(fetchGeminiUsage).toHaveBeenCalled();
      });
    });

    describe("when model provider is unknown", () => {
      it("then it should not set a widget", async () => {
        quotasExtension(mockPi as unknown as ExtensionAPI);

        const handler = mockPi.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];

        const mockCtx = {
          model: { provider: "unknown", id: "unknown-model" },
          ui: { setWidget: vi.fn() },
        };

        await handler({}, mockCtx);

        expect(mockCtx.ui.setWidget).toHaveBeenCalledWith("quotas", undefined);
      });
    });
  });

  describe("given quotas:refresh command is executed", () => {
    it("then it should refresh usage data", async () => {
      const { fetchAnthropicUsage } = await import("./providers/anthropic");
      vi.mocked(fetchAnthropicUsage).mockResolvedValue({
        provider: "anthropic",
        displayName: "Anthropic",
        windows: [{ label: "Daily", usedPercent: 75 }],
      });

      quotasExtension(mockPi as unknown as ExtensionAPI);

      // First trigger session_start to set context
      const sessionHandler = mockPi.on.mock.calls.find(
        (call) => call[0] === "session_start",
      )?.[1];

      const mockCtx = {
        model: { provider: "anthropic", id: "claude-3" },
        ui: { setWidget: vi.fn() },
      };

      await sessionHandler({}, mockCtx);

      // Then execute refresh command
      const command = mockPi.registerCommand!.mock.calls.find(
        (call) => call[0] === "quotas:refresh",
      )?.[1];

      await command.handler();

      // Should have called fetchAnthropicUsage twice
      expect(fetchAnthropicUsage).toHaveBeenCalledTimes(2);
    });
  });

  describe("given usage has an error", () => {
    it("then it should display the error in widget", async () => {
      const { fetchAnthropicUsage } = await import("./providers/anthropic");
      vi.mocked(fetchAnthropicUsage).mockResolvedValue({
        provider: "anthropic",
        displayName: "Anthropic",
        windows: [],
        error: "API key not found",
      });

      quotasExtension(mockPi as unknown as ExtensionAPI);

      const handler = mockPi.on.mock.calls.find(
        (call) => call[0] === "session_start",
      )?.[1];

      const mockCtx = {
        model: { provider: "anthropic", id: "claude-3" },
        ui: { setWidget: vi.fn() },
      };

      await handler({}, mockCtx);

      expect(mockCtx.ui.setWidget).toHaveBeenCalledWith(
        "quotas",
        expect.any(Function),
        expect.any(Object),
      );

      // Get the widget factory and call it to verify output
      const widgetFactory = mockCtx.ui.setWidget.mock.calls[0][1];
      const widget = widgetFactory(null, null);
      const rendered = widget.render(80);

      expect(rendered[0]).toContain("API key not found");
    });
  });

  describe("given usage returns multiple windows", () => {
    it("then it should format all windows in the display", async () => {
      const { fetchAnthropicUsage } = await import("./providers/anthropic");
      vi.mocked(fetchAnthropicUsage).mockResolvedValue({
        provider: "anthropic",
        displayName: "Anthropic",
        windows: [
          { label: "Daily", usedPercent: 50, resetDescription: "12h" },
          { label: "Monthly", usedPercent: 25, resetDescription: "15d" },
        ],
      });

      quotasExtension(mockPi as unknown as ExtensionAPI);

      const handler = mockPi.on.mock.calls.find(
        (call) => call[0] === "session_start",
      )?.[1];

      const mockCtx = {
        model: { provider: "anthropic", id: "claude-3" },
        ui: { setWidget: vi.fn() },
      };

      await handler({}, mockCtx);

      const widgetFactory = mockCtx.ui.setWidget.mock.calls[0][1];
      const widget = widgetFactory(null, null);
      const rendered = widget.render(80);

      expect(rendered[0]).toContain("Daily");
      expect(rendered[0]).toContain("50%");
      expect(rendered[0]).toContain("Monthly");
      expect(rendered[0]).toContain("25%");
    });
  });
});
