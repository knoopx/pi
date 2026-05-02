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
} from "../../shared/testing/test-utils";
import duckduckgoExtension from "./index";
import { disableThrottle } from "../../shared/network/throttle";

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
      undefined,
      undefined,
      {} as ExtensionContext,
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

  it("should register search-web tool", () => {
    const call = mockPi.registerTool.mock.calls[0] as [MockTool];
    expect(call[0].name).toBe("search-web");
    expect(call[0].label).toBe("Search DuckDuckGo");
    expect(call[0].description).toContain("Search using DuckDuckGo");
  });

  describe("Tool Execution", () => {
    it("should return error when search fails with network error", async () => {
      const mockFetch = vi.fn<typeof global.fetch>();
      mockFetch.mockRejectedValue(new Error("Network error"));
      const result = await executeSearchTool(toolConfig, mockFetch);

      expect((result.content[0] as TextContent).text).toBe(
        "Error: DuckDuckGo search failed",
      );
      expect(result.details.query).toBe("test query");
    });

    it("should format search results correctly", async () => {
      const mockHtmlWithResults = `
        <div class="result">
          <a class="result__a" href="https://bun.sh/">Bun – JavaScript, TypeScript, and Dart runtime</a>
          <div class="result__snippet">An extremely fast JavaScript runtime, transpiler, and package manager. Built in Zig for sub-millisecond cold starts and a SQLite-based local cache.</div>
          <div class="result__url">bun.sh</div>
        </div>
        <div class="result">
          <a class="result__a" href="https://deno.land/">Deno – A secure runtime for JavaScript and TypeScript</a>
          <div class="result__snippet">A modern runtime for JavaScript, TypeScript, and WebAssembly. Uses V8, built with Rust, and secured by default with a permission system.</div>
          <div class="result__url">deno.land</div>
        </div>
        <div class="result">
          <a class="result__a" href="https://nodejs.org/en">node.js – JavaScript runtime</a>
          <div class="result__snippet">Node.js is a free, open-source, cross-platform JavaScript runtime environment. Built on V8 and used for server-side networking APIs.</div>
          <div class="result__url">nodejs.org</div>
        </div>
        <div class="result">
          <a class="result__a" href="https://www.typescriptlang.org/">TypeScript: The Language for Application Scale</a>
          <div class="result__snippet">TypeScript extends JavaScript by adding types to the language. It compiles to clean, readable JavaScript and powers modern tooling.</div>
          <div class="result__url">www.typescriptlang.org</div>
        </div>
        <div class="result">
          <a class="result__a" href="https://github.com/oven-sh/bun">oven-sh/bun: An extremely fast JavaScript runtime, bundler, transpiler, and package manager</a>
          <div class="result__snippet">Bun is an all-in-one toolchain including a JS runtime, bundler, transpiler, and package manager. It's written in Zig and focuses on speed.</div>
          <div class="result__url">github.com</div>
        </div>
      `;
      let fetchCallCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve("<html>No preload</html>"),
          });
        }
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
