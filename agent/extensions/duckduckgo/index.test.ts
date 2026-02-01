import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TextContent } from "@mariozechner/pi-ai";
import duckduckgoExtension from "./index";

// Mock axios
vi.mock("axios");
import axios from "axios";

describe("DuckDuckGo Extension", () => {
  let mockRegisterTool: any;
  let mockPi: any;
  let toolConfig: any;

  beforeEach(() => {
    mockRegisterTool = vi.fn();
    mockPi = {
      registerTool: mockRegisterTool,
    };

    duckduckgoExtension(mockPi);
    toolConfig = mockRegisterTool.mock.calls[0][0];
  });

  it("should register search-duckduckgo tool", () => {
    expect(mockRegisterTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-duckduckgo",
        label: "Search DuckDuckGo",
        description: expect.stringContaining("Search using DuckDuckGo"),
      })
    );
  });

  describe("Tool Execution", () => {
    it("should return no results message when search returns empty", async () => {
      const mockAxiosGet = vi.fn().mockRejectedValue(new Error("Network error"));
      axios.get = mockAxiosGet;

      const result = await toolConfig.execute(
        "test-id",
        { query: "test query", limit: 5 },
        vi.fn(),
        {} as any,
        new AbortController().signal
      );

      expect((result.content[0] as TextContent).text).toContain("No results found");
      expect(result.details).toEqual({ query: "test query", limit: 5 });
    });

    it("should format search results correctly", async () => {
      // Mock successful search response
      const mockHtml = `
        <div class="result">
          <a class="result__a" href="https://example.com">Example Title</a>
          <div class="result__snippet">Example description</div>
          <div class="result__url">example.com</div>
        </div>
      `;

      // Mock all axios calls
      let callCount = 0;
      const mockAxiosGet = vi.fn().mockResolvedValue({ data: "<html>No preload</html>" });
      const mockAxiosPost = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: mockHtml });
        } else {
          return Promise.resolve({ data: '<div class="result"><!-- no more results --></div>' });
        }
      });

      axios.get = mockAxiosGet;
      axios.post = mockAxiosPost;

      const result = await toolConfig.execute(
        "test-id",
        { query: "test query", limit: 5 },
        vi.fn(),
        {} as any,
        new AbortController().signal
      );

      expect((result.content[0] as TextContent).text).toBe("Example Title\nhttps://example.com\nExample description\n");
      expect(result.details.results).toBeDefined();
    });
  });
});