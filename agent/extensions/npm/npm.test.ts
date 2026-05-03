import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import setupNpmExtension from "./index";
import type {
  MockTool,
  MockExtensionAPI,
} from "../../shared/testing/test-utils";
import { createMockExtensionAPI } from "../../shared/testing/test-utils";

import { disableThrottle } from "../../shared/network/throttle";

async function runWithFetch(
  tool: MockTool,
  params: unknown,
  options?: {
    jsonResponse?: unknown;
    errorStatus?: number;
    errorText?: string;
  },
): Promise<
  AgentToolResult<Record<string, unknown>> & {
    __mockFetch: ReturnType<typeof vi.fn>;
    __capturedUrl: string | undefined;
  }
> {
  let capturedUrl: string | undefined;
  const mockFn = vi.fn((input: string | URL) => {
    capturedUrl = typeof input === "string" ? input : String(input);
    if (options?.errorStatus) {
      return new Response(null, {
        status: options.errorStatus,
        statusText: options.errorText ?? "",
      });
    }
    return new Response(JSON.stringify(options?.jsonResponse), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  globalThis.fetch = mockFn as unknown as typeof globalThis.fetch;
  const result = await tool.execute(
    "tool1",
    params,
    undefined,
    undefined,
    undefined,
  );
  const enriched = result as AgentToolResult<Record<string, unknown>> & {
    __mockFetch: ReturnType<typeof vi.fn>;
    __capturedUrl: string | undefined;
  };
  enriched.__capturedUrl = capturedUrl;
  enriched.__mockFetch = mockFn;
  return enriched;
}
function get<T extends object>(obj: T, path: string): unknown {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
function testErrorHandling(
  getTool: () => MockTool,
  params: Record<string, string>,
  messages: {
    okMsg: string;
    failMsgPrefix: string;
    netFailMsgPrefix: string;
  },
): void {
  it("then it should return error message", async () => {
    const result = await runWithFetch(getTool(), params, {
      errorStatus: 500,
      errorText: "Internal Server Error",
    });
    expect((result.content[0] as TextContent).text).toBe(
      `${messages.failMsgPrefix} Internal Server Error`,
    );
  });

  it("then it should return error on network failure", async () => {
    const mockFetchFn = vi.fn().mockRejectedValue(new Error("Network error"));
    const mockFetch = mockFetchFn as unknown as typeof globalThis.fetch;
    globalThis.fetch = mockFetch;
    const result = await getTool().execute(
      "tool1",
      params,
      undefined,
      undefined,
      undefined,
    );
    expect((result.content[0] as TextContent).text).toBe(
      `${messages.netFailMsgPrefix} Network error`,
    );
  });
}

describe("NPM Extension", () => {
  let mockPi: MockExtensionAPI;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    disableThrottle();
    mockPi = createMockExtensionAPI();
    originalFetch = globalThis.fetch;
    setupNpmExtension(mockPi as ExtensionAPI);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("given the extension is initialized", () => {
    describe("when registering tools", () => {
      it("then it should register npm search tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({ name: "search-npm-packages" }),
        );
      });
    });
  });

  describe("search-npm-packages", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      const found = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "search-npm-packages",
      );
      if (!found) throw new Error("search-npm-packages tool not registered");
      registeredTool = found[0] as MockTool;
    });

    describe("given a valid search query", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockResponseData = {
          objects: [
            {
              package: {
                name: "lodash",
                version: "4.17.21",
                description: "A modern JavaScript utility library",
                keywords: ["util", "functional", "server", "client", "browser"],
                author: { name: "John-David Dalton" },
              },
            },
          ],
        };

        result = await runWithFetch(
          registeredTool,
          { query: "lodash", size: 1 },
          {
            jsonResponse: mockResponseData,
          },
        );
      });

      it("then it should return formatted search results", () => {
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe("text");
        expect((result.content[0] as TextContent).text).toMatchSnapshot();
        expect(result.details.query).toBe("lodash");
        expect(result.details.count).toBe(1);
        expect(get(result.details, "packages.0.author")).toBe(
          "John-David Dalton",
        );
      });
    });

    describe("given a search query without size parameter", () => {
      it("then it should use default size of 10", async () => {
        const result = await runWithFetch(
          registeredTool,
          { query: "test" },
          {
            jsonResponse: { objects: [] },
          },
        );
        expect(result.__mockFetch.mock.calls[0]?.[0]).toContain("size=10");
        expect((result.content[0] as TextContent).text).toBe(
          "No packages found.",
        );
      });
    });

    describe("given a search query with no results", () => {
      it("then it should return no packages found message", async () => {
        const result = await runWithFetch(
          registeredTool,
          { query: "nonexistent-pkg-xyz-123" },
          {
            jsonResponse: { objects: [] },
          },
        );
        expect((result.content[0] as TextContent).text).toBe(
          "No packages found.",
        );
        expect(result.details.count).toBe(0);
      });
    });

    describe("given an HTTP request fails", () => {
      it("then it should return error message", async () => {
        const result = await runWithFetch(
          registeredTool,
          { query: "test" },
          {
            errorStatus: 404,
            errorText: "Not Found",
          },
        );
        expect((result.content[0] as TextContent).text).toBe(
          "Failed to search packages: Not Found",
        );
        expect(result.details.status).toBe(404);
      });

      it("then it should include the status text in the error", async () => {
        const result = await runWithFetch(
          registeredTool,
          { query: "test" },
          {
            errorStatus: 500,
            errorText: "Internal Server Error",
          },
        );
        expect((result.content[0] as TextContent).text).toBe(
          "Failed to search packages: Internal Server Error",
        );
        expect(result.details.status).toBe(500);
      });
    });

    describe("given the fetch function throws an error", () => {
      testErrorHandling(
        () => registeredTool,
        { query: "test" },
        {
          okMsg: "No packages found.",
          failMsgPrefix: "Failed to search packages:",
          netFailMsgPrefix: "Error searching packages:",
        },
      );
    });
  });
});
