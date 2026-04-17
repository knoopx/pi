import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TextContent } from "@mariozechner/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  createMockExtensionAPI,
  type MockExtensionAPI,
  type MockTool,
} from "../../shared/test-utils";
import duckduckgoExtension from "./index";
import { disableThrottle } from "../../shared/throttle";

/**
 * Helper to execute the search tool with fetch mocking
 */
async function executeSearchTool(
  toolConfig: MockTool,
  mockFetch: typeof global.fetch,
) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch;
  try {
    return await toolConfig.execute(
      "test-id",
      { query: "test query", limit: 5 },
      vi.fn(),
      {} as ExtensionContext,
      new AbortController().signal,
    );
  } finally {
    global.fetch = originalFetch;
  }
}

describe("DuckDuckGo Extension", () => {
  let mockPi: MockExtensionAPI;
  let toolConfig: MockTool;

  beforeEach(() => {
    disableThrottle();
    mockPi = createMockExtensionAPI();
    duckduckgoExtension(mockPi as unknown as ExtensionAPI);
    toolConfig = mockPi.registerTool.mock.calls[0][0] as MockTool;
  });

  it("should register search-duckduckgo tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-duckduckgo",
        label: "Search DuckDuckGo",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        description: expect.stringContaining("Search using DuckDuckGo"),
      }),
    );
  });

  describe("Tool Execution", () => {
    it("should return no results message when search returns empty", async () => {
      const result = await executeSearchTool(
        toolConfig,
        vi.fn().mockRejectedValue(new Error("Network error")),
      );

      expect((result.content[0] as TextContent).text).toBe("No results found.");
      expect(result.details).toEqual({ query: "test query", limit: 5 });
    });

    it("should format search results correctly", async () => {
      const mockHtmlWithResults = `
        <div class="result">
          <a class="result__a" href="https://example.com">Example Title</a>
          <div class="result__snippet">Example description</div>
          <div class="result__url">example.com</div>
        </div>
      `;

      let fetchCallCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          // First call - GET request for search page
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve("<html>No preload</html>"),
          });
        }
        // Subsequent calls - POST requests for results
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              fetchCallCount === 2 ? mockHtmlWithResults : "<html></html>",
            ),
        });
      });

      const result = await executeSearchTool(toolConfig, mockFetch);

      expect((result.content[0] as TextContent).text).toMatchSnapshot();
      expect(result.details.results).toBeDefined();
    });
  });
});
