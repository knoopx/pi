import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectAndFetchUsage, formatUsageSnapshot } from "./shared";
import type { BaseDependencies, UsageSnapshot } from "./types";

// Mock the provider modules
vi.mock("./providers/anthropic", () => ({
  fetchAnthropicUsage: vi.fn(),
}));
vi.mock("./providers/copilot", () => ({
  fetchCopilotUsage: vi.fn(),
}));
vi.mock("./providers/gemini", () => ({
  fetchGeminiUsage: vi.fn(),
}));
vi.mock("./providers/openai", () => ({
  fetchOpenAIUsage: vi.fn(),
}));

describe("detectAndFetchUsage", () => {
  const createMockDeps = (): BaseDependencies => ({
    homedir: () => "/home/user",
    fileExists: () => true,
    readFile: () => JSON.stringify({ anthropic: { access: "token" } }),
    fetch: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("given Anthropic model", () => {
    describe("when provider is anthropic", () => {
      it("then calls Anthropic usage fetcher", async () => {
        const { fetchAnthropicUsage } = await import("./providers/anthropic");
        const mockSnapshot: UsageSnapshot = {
          provider: "anthropic",
          displayName: "Anthropic",
          windows: [{ label: "5h", usedPercent: 50 }],
        };
        vi.mocked(fetchAnthropicUsage).mockResolvedValueOnce(mockSnapshot);

        const result = await detectAndFetchUsage(
          { provider: "anthropic", id: "claude-3" },
          createMockDeps(),
        );

        expect(fetchAnthropicUsage).toHaveBeenCalled();
        expect(result).toEqual(mockSnapshot);
      });
    });

    describe("when model ID contains claude", () => {
      it("then calls Anthropic usage fetcher", async () => {
        const { fetchAnthropicUsage } = await import("./providers/anthropic");
        vi.mocked(fetchAnthropicUsage).mockResolvedValueOnce(null);

        await detectAndFetchUsage(
          { provider: "other", id: "claude-3-sonnet" },
          createMockDeps(),
        );

        expect(fetchAnthropicUsage).toHaveBeenCalled();
      });
    });
  });

  describe("given OpenAI model", () => {
    describe("when provider is openai", () => {
      it("then calls OpenAI usage fetcher", async () => {
        const { fetchOpenAIUsage } = await import("./providers/openai");
        vi.mocked(fetchOpenAIUsage).mockResolvedValueOnce(null);

        await detectAndFetchUsage(
          { provider: "openai", id: "gpt-4" },
          createMockDeps(),
        );

        expect(fetchOpenAIUsage).toHaveBeenCalled();
      });
    });

    describe("when model ID contains gpt", () => {
      it("then calls OpenAI usage fetcher", async () => {
        const { fetchOpenAIUsage } = await import("./providers/openai");
        vi.mocked(fetchOpenAIUsage).mockResolvedValueOnce(null);

        await detectAndFetchUsage(
          { provider: "other", id: "gpt-4-turbo" },
          createMockDeps(),
        );

        expect(fetchOpenAIUsage).toHaveBeenCalled();
      });
    });

    describe("when provider is codex", () => {
      it("then calls OpenAI usage fetcher", async () => {
        const { fetchOpenAIUsage } = await import("./providers/openai");
        vi.mocked(fetchOpenAIUsage).mockResolvedValueOnce(null);

        await detectAndFetchUsage(
          { provider: "codex", id: "model" },
          createMockDeps(),
        );

        expect(fetchOpenAIUsage).toHaveBeenCalled();
      });
    });
  });

  describe("given GitHub Copilot model", () => {
    describe("when provider is github", () => {
      it("then calls Copilot usage fetcher", async () => {
        const { fetchCopilotUsage } = await import("./providers/copilot");
        vi.mocked(fetchCopilotUsage).mockResolvedValueOnce(null);

        await detectAndFetchUsage(
          { provider: "github", id: "model" },
          createMockDeps(),
        );

        expect(fetchCopilotUsage).toHaveBeenCalled();
      });
    });

    describe("when provider is copilot", () => {
      it("then calls Copilot usage fetcher", async () => {
        const { fetchCopilotUsage } = await import("./providers/copilot");
        vi.mocked(fetchCopilotUsage).mockResolvedValueOnce(null);

        await detectAndFetchUsage(
          { provider: "copilot", id: "model" },
          createMockDeps(),
        );

        expect(fetchCopilotUsage).toHaveBeenCalled();
      });
    });
  });

  describe("given Google Gemini model", () => {
    describe("when provider is google", () => {
      it("then calls Gemini usage fetcher", async () => {
        const { fetchGeminiUsage } = await import("./providers/gemini");
        vi.mocked(fetchGeminiUsage).mockResolvedValueOnce(null);

        await detectAndFetchUsage(
          { provider: "google", id: "model" },
          createMockDeps(),
        );

        expect(fetchGeminiUsage).toHaveBeenCalled();
      });
    });

    describe("when model ID contains gemini", () => {
      it("then calls Gemini usage fetcher", async () => {
        const { fetchGeminiUsage } = await import("./providers/gemini");
        vi.mocked(fetchGeminiUsage).mockResolvedValueOnce(null);

        await detectAndFetchUsage(
          { provider: "other", id: "gemini-pro" },
          createMockDeps(),
        );

        expect(fetchGeminiUsage).toHaveBeenCalled();
      });
    });
  });

  describe("given unknown provider", () => {
    describe("when no match found", () => {
      it("then returns undefined", async () => {
        const result = await detectAndFetchUsage(
          { provider: "unknown", id: "unknown-model" },
          createMockDeps(),
        );

        expect(result).toBeUndefined();
      });
    });
  });

  describe("given undefined model", () => {
    describe("when model is undefined", () => {
      it("then returns undefined", async () => {
        const result = await detectAndFetchUsage(undefined, createMockDeps());
        expect(result).toBeUndefined();
      });
    });
  });
});

describe("formatUsageSnapshot", () => {
  describe("given undefined usage", () => {
    describe("when formatting", () => {
      it("then returns unavailable message", () => {
        expect(formatUsageSnapshot(undefined)).toBe("Quota: unavailable");
      });
    });
  });

  describe("given usage with error", () => {
    describe("when formatting", () => {
      it("then returns error message", () => {
        const usage: UsageSnapshot = {
          provider: "test",
          displayName: "Test",
          windows: [],
          error: "Auth failed",
        };

        expect(formatUsageSnapshot(usage)).toBe("Quota: Auth failed");
      });
    });
  });

  describe("given usage with empty windows", () => {
    describe("when formatting", () => {
      it("then returns no data message", () => {
        const usage: UsageSnapshot = {
          provider: "test",
          displayName: "Test",
          windows: [],
        };

        expect(formatUsageSnapshot(usage)).toBe("Quota: no data");
      });
    });
  });

  describe("given usage with single window", () => {
    describe("when formatting", () => {
      it("then returns formatted window", () => {
        const usage: UsageSnapshot = {
          provider: "test",
          displayName: "Test",
          windows: [{ label: "5h", usedPercent: 45.7 }],
        };

        expect(formatUsageSnapshot(usage)).toBe("5h: 46%");
      });
    });
  });

  describe("given usage with multiple windows", () => {
    describe("when formatting", () => {
      it("then joins windows with comma", () => {
        const usage: UsageSnapshot = {
          provider: "test",
          displayName: "Test",
          windows: [
            { label: "5h", usedPercent: 30 },
            { label: "Week", usedPercent: 75 },
          ],
        };

        expect(formatUsageSnapshot(usage)).toBe("5h: 30%, Week: 75%");
      });
    });
  });

  describe("given usage with reset description", () => {
    describe("when formatting", () => {
      it("then includes reset info", () => {
        const usage: UsageSnapshot = {
          provider: "test",
          displayName: "Test",
          windows: [
            { label: "5h", usedPercent: 50, resetDescription: "2h 30m" },
          ],
        };

        expect(formatUsageSnapshot(usage)).toBe("5h: 50% (2h 30m)");
      });
    });
  });
});
