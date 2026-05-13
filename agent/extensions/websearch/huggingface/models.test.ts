import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import websearchExtension from "../index";
import type {
  MockTool,
  MockExtensionAPI,
} from "../../../shared/testing/test-utils";
import { createMockExtensionAPI } from "../../../shared/testing/test-utils";
import { disableThrottle } from "../../../shared/network/throttle";

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

const mockSearchResults = [
  {
    id: "unsloth/Qwen3-GGUF",
    modelId: "unsloth/Qwen3-GGUF",
    author: "unsloth",
    sha: "abc123",
    downloads: 150000,
    likes: 42,
    tags: ["gguf", "text-generation", "license:apache-2.0"],
    pipeline_tag: "text-generation",
    library_name: "gguf",
    lastModified: "2025-01-01T00:00:00Z",
    createdAt: "2024-12-01T00:00:00Z",
    gated: false,
    private: false,
  },
];

describe("HuggingFace Extension", () => {
  let mockPi: MockExtensionAPI;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    disableThrottle();
    mockPi = createMockExtensionAPI();
    originalFetch = globalThis.fetch;
    websearchExtension(mockPi as unknown as ExtensionAPI);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("given the extension is initialized", () => {
    it("then it should register hf-search-models tool", () => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "hf-search-models" }),
      );
    });
  });

  describe("hf-search-models", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) => (call[0] as MockTool).name === "hf-search-models",
      )![0] as MockTool;
    });

    describe("given a successful search response", () => {
      it("then it should return formatted search results", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockSearchResults,
        }) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          { query: "Qwen GGUF" },
          undefined,
          undefined,
          {},
        );

        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.query).toBe("Qwen GGUF");
      });
    });

    describe("given no models match", () => {
      it("then it should return no results message", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => [],
        }) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          { query: "nonexistent-model-xyz" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          'No models found for "nonexistent-model-xyz" with current filters.',
        );
      });
    });

    describe("given an API error", () => {
      it("then it should throw", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        }) as unknown as typeof globalThis.fetch;

        await expect(
          tool.execute("tool1", { query: "test" }, undefined, undefined, {}),
        ).rejects.toThrow();
      });
    });
  });
});
