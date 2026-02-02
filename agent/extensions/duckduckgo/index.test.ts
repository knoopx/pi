import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createMockExtensionAPI, type MockExtensionAPI, type MockTool } from "../../test-utils";
import duckduckgoExtension from "./index";

// Mock axios
vi.mock("axios");
import axios from "axios";

describe("DuckDuckGo Extension", () => {
  let mockPi: MockExtensionAPI;
  let toolConfig: MockTool;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    duckduckgoExtension(mockPi as unknown as ExtensionAPI);
    toolConfig = mockPi.registerTool.mock.calls[0][0] as MockTool;
  });

  it("should register search-duckduckgo tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-duckduckgo",
        label: "Search DuckDuckGo",
        description: expect.stringContaining("Search using DuckDuckGo"),
      }),
    );
  });

  describe("Tool Execution", () => {
    it("should return no results message when search returns empty", async () => {
      const mockAxiosGet = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));
      const mockAxiosPost = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      axios.get = mockAxiosGet;
      axios.post = mockAxiosPost;

      const result = await toolConfig.execute(
        "test-id",
        { query: "test query", limit: 5 },
        vi.fn(),
        {} as ExtensionContext,
        new AbortController().signal,
      );

      expect((result.content[0] as TextContent).text).toContain(
        "No results found",
      );
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

      const mockAxiosGet = vi
        .fn()
        .mockResolvedValue({ data: "<html>No preload</html>" });

      let postCallCount = 0;
      const mockAxiosPost = vi.fn().mockImplementation(() => {
        postCallCount++;
        if (postCallCount === 1) {
          return Promise.resolve({ data: mockHtmlWithResults });
        } else {
          return Promise.resolve({ data: "<html></html>" });
        }
      });

      axios.get = mockAxiosGet;
      axios.post = mockAxiosPost;

      const result = await toolConfig.execute(
        "test-id",
        { query: "test query", limit: 5 },
        vi.fn(),
        {} as ExtensionContext,
        new AbortController().signal,
      );

      expect((result.content[0] as TextContent).text).toBe(
        "Example Title\nhttps://example.com\nExample description\n",
      );
      expect(result.details.results).toBeDefined();
    });
  });
});
