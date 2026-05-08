import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import setupHuggingFaceExtension from "./index";
import type {
  MockTool,
  MockExtensionAPI,
} from "../../shared/testing/test-utils";
import { createMockExtensionAPI } from "../../shared/testing/test-utils";
import { disableThrottle } from "../../shared/network/throttle";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

function mockFetch(jsonData: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => jsonData,
  }) as unknown as typeof globalThis.fetch;
}

async function executeTool(
  tool: MockTool,
  params: Record<string, unknown>,
): Promise<{
  content: Array<{ type: string; text?: string }>;
  details: Record<string, unknown>;
}> {
  return tool.execute("tool1", params, undefined, undefined, {});
}

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

const mockDiscussionList = {
  discussions: [
    {
      num: 1,
      title: "Model crashes on long inputs",
      status: "open",
      isPullRequest: false,
      pinned: false,
      createdAt: "2025-01-01T00:00:00Z",
      numComments: 5,
      numReactionUsers: 2,
      topReactions: [{ reaction: "👍", count: 2 }],
      author: {
        name: "testuser",
        type: "user",
      },
    },
    {
      num: 2,
      title: "Add quantized model",
      status: "closed",
      isPullRequest: true,
      pinned: false,
      createdAt: "2024-12-01T00:00:00Z",
      numComments: 3,
      numReactionUsers: 0,
      topReactions: [],
      author: {
        name: "contributor",
        type: "user",
      },
    },
  ],
  count: 2,
  start: 0,
  numClosedDiscussions: 1,
};

describe("HuggingFace Extension", () => {
  let mockPi: MockExtensionAPI;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    disableThrottle();
    mockPi = createMockExtensionAPI();
    originalFetch = globalThis.fetch;
    setupHuggingFaceExtension(mockPi as unknown as ExtensionAPI);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("given the extension is initialized", () => {
    it("then it should register search-huggingface-models tool", () => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "search-huggingface-models" }),
      );
    });

    it("then it should register list-huggingface-discussions tool", () => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "list-huggingface-discussions" }),
      );
    });
  });

  describe("search-huggingface-models", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as MockTool).name === "search-huggingface-models",
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

  describe("list-huggingface-discussions", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as MockTool).name === "list-huggingface-discussions",
      )![0] as MockTool;
    });

    describe("given a successful response", () => {
      it("then it should return formatted discussion list", async () => {
        mockFetch(mockDiscussionList);

        const result = await executeTool(tool, { model: "unsloth/Qwen3-GGUF" });

        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.model).toBe("unsloth/Qwen3-GGUF");
        expect(result.details.count).toBe(2);
      });
    });

    describe("given status filter excludes all results", () => {
      it("then it should return no discussions message", async () => {
        const emptyList = { ...mockDiscussionList, discussions: [] };
        mockFetch(emptyList);

        const result = await executeTool(tool, {
          model: "unsloth/Qwen3-GGUF",
          status: "open",
        });

        expect((result.content[0] as TextContent).text).toBe(
          "No discussions found for unsloth/Qwen3-GGUF with current filters.",
        );
      });
    });
  });
});
