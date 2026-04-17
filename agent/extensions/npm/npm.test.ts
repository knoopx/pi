import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import setupNpmExtension from "./index";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";

import { disableThrottle } from "../../shared/throttle";

const stripAnsi = (s: string): string => {
  const ansiEscape = String.fromCharCode(27);
  return s.replace(new RegExp(`[${ansiEscape}][\\[][\\d;]*m`, "g"), "");
};

/** Run a tool with the given mock fetch response set up. */
async function runWithFetch(
  tool: MockTool,
  params: unknown,
  jsonResponse?: unknown,
  errorStatus?: number,
  errorText?: string,
): Promise<
  AgentToolResult<Record<string, unknown>> & {
    __mockFetch: ReturnType<typeof vi.fn>;
    __capturedUrl: string | undefined;
  }
> {
  let capturedUrl: string | undefined;
  const mockFn = vi.fn(async (input: string | URL) => {
    capturedUrl = typeof input === "string" ? input : String(input);
    if (errorStatus) {
      return new Response(null, {
        status: errorStatus,
        statusText: errorText ?? "",
      });
    }
    return new Response(JSON.stringify(jsonResponse), {
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

/** Test HTTP and network error handling for a registered tool. */
function testErrorHandling(
  tool: MockTool,
  params: Record<string, string>,
  okMsg: string,
  failMsgPrefix: string,
): void {
  it("then it should return error message", async () => {
    const result = await runWithFetch(
      tool,
      params,
      undefined,
      500,
      "Internal Server Error",
    );
    expect((result.content[0] as TextContent).text).toBe(
      `${failMsgPrefix} Internal Server Error`,
    );
  });

  it("then it should return error on network failure", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new Error("Network error"))
      as unknown as typeof globalThis.fetch;
    globalThis.fetch = mockFetch;
    const result = await tool.execute(
      "tool1",
      params,
      undefined,
      undefined,
      undefined,
    );
    expect((result.content[0] as TextContent).text).toBe(
      `${failMsgPrefix} Network error`,
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

      it("then it should register npm package info tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({ name: "npm-package-info" }),
        );
      });

      it("then it should register npm package versions tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({ name: "npm-package-versions" }),
        );
      });
    });
  });

  describe("search-npm-packages", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "search-npm-packages",
      )![0] as MockTool;
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
          mockResponseData,
        );
      });

      it("then it should return formatted search results", () => {
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe("text");
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
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
          { objects: [] },
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
          { objects: [] },
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
          undefined,
          404,
          "Not Found",
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
          undefined,
          500,
          "Internal Server Error",
        );
        expect((result.content[0] as TextContent).text).toBe(
          "Failed to search packages: Internal Server Error",
        );
        expect(result.details.status).toBe(500);
      });
    });

    describe("given the fetch function throws an error", () => {
      testErrorHandling(
        registeredTool,
        { query: "test" },
        "No packages found.",
        "Error searching packages:",
      );
    });
  });

  describe.each([
    {
      name: "npm-package-info",
      toolName: "npm-package-info",
      action: "get package info",
    },
    {
      name: "npm-package-versions",
      toolName: "npm-package-versions",
      action: "get package versions",
    },
  ])(`$name`, ({ toolName, action }) => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === toolName,
      )![0] as MockTool;
    });

    describe("given a valid package", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockPackageData =
          toolName === "npm-package-info"
            ? {
                name: "express",
                description: "Fast, unopinionated, minimalist web framework",
                author: { name: "TJ Holowaychuk" },
                maintainers: [
                  { name: "TJ Holowaychuk" },
                  { name: "Douglas Wilson" },
                ],
                homepage: "http://expressjs.com/",
                repository: {
                  url: "git+https://github.com/expressjs/express.git",
                },
                keywords: ["express", "framework", "web", "http"],
                "dist-tags": { latest: "4.18.2" },
                versions: {
                  "4.18.2": {
                    license: "MIT",
                    dependencies: {},
                    devDependencies: {},
                  },
                },
              }
            : {
                name: "lodash",
                "dist-tags": { latest: "4.17.21", beta: "4.17.21-rc.1" },
                versions: { "4.17.21": {}, "4.17.20": {}, "4.17.21-rc.1": {} },
              };

        result = await runWithFetch(
          registeredTool,
          { package: toolName === "npm-package-info" ? "express" : "lodash" },
          mockPackageData,
        );
      });

      it("then it should return formatted data", () => {
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.package).toBe(
          toolName === "npm-package-info" ? "express" : "lodash",
        );
        if (toolName === "npm-package-info") {
          expect(get(result.details, "info.name")).toBe("express");
          expect(get(result.details, "info.license")).toBe("MIT");
        } else {
          expect(result.details.count).toBe(3);
        }
      });
    });

    describe("given a package that does not exist", () => {
      it("then it should return not found message", async () => {
        const result = await runWithFetch(
          registeredTool,
          { package: "nonexistent-pkg-xyz-123" },
          undefined,
          404,
          "Not Found",
        );
        expect((result.content[0] as TextContent).text).toBe(
          'Package "nonexistent-pkg-xyz-123" not found.',
        );
        if (toolName === "npm-package-info") {
          expect(result.details.status).toBe(404);
        }
      });
    });

    describe("given an HTTP request returns server error", () => {
      it("then it should return error message", async () => {
        const result = await runWithFetch(
          registeredTool,
          { package: "lodash" },
          undefined,
          500,
          "Internal Server Error",
        );
        expect((result.content[0] as TextContent).text).toBe(
          `Failed to ${action}: Internal Server Error`,
        );
        expect(result.details.status).toBe(500);
      });
    });

    describe("given the fetch function throws an error", () => {
      testErrorHandling(
        registeredTool,
        { package: "lodash" },
        `No packages found.`,
        `Error ${action}:`,
      );
    });
  });
});
