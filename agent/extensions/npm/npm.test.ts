import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import setupNpmExtension from "./index";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";

import { disableThrottle } from "../../shared/throttle";

// Strip ANSI codes from strings
const stripAnsi = (s: string): string => {
  // Match ANSI escape sequences: ESC [ ... m
  const ansiEscape = String.fromCharCode(27);
  return s.replace(new RegExp(`[${ansiEscape}][\\[][\\d;]*m`, "g"), "");
};

// Shared mock fetch helpers for error cases
function createMockFetchNotFound() {
  return vi.fn().mockImplementation((..._args: unknown[]) => {
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      preconnect: vi.fn(),
    };
  });
}

function createMockFetchServerError() {
  return vi.fn().mockImplementation((..._args: unknown[]) => {
    return {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      preconnect: vi.fn(),
    };
  });
}

function createMockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new Error("Network error"));
}

// ============================================
// Extension Registration
// ============================================
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
          expect.objectContaining({
            name: "search-npm-packages",
          }),
        );
      });

      it("then it should register npm package info tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "npm-package-info",
          }),
        );
      });

      it("then it should register npm package versions tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "npm-package-versions",
          }),
        );
      });
    });
  });

  // ============================================
  // Search NPM Packages
  // ============================================
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

        const mockFetch = vi.fn().mockImplementation((..._args) => ({
          ok: true,
          json: () => Promise.resolve(mockResponseData),
          preconnect: vi.fn(),
        }));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute(
          "tool1",
          {
            query: "lodash",
            size: 1,
          },
          undefined,
          undefined,
          {} as any,
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
        expect((result.details as any).packages[0].author).toBe(
          "John-David Dalton",
        );
      });
    });

    describe("given a search query without size parameter", () => {
      it("then it should use default size of 10", async () => {
        const mockFetch = vi.fn().mockImplementation((..._args) => ({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
          preconnect: vi.fn(),
        }));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        const result = await registeredTool.execute(
          "tool1",
          {
            query: "test",
          },
          undefined,
          undefined,
          {} as any,
        );

        const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
        expect(calledUrl).toContain("size=10");
        expect((result.content[0] as TextContent).text).toBe(
          "No packages found.",
        );
      });
    });

    describe("given a search query with no results", () => {
      it("then it should return no packages found message", async () => {
        const mockFetch = vi.fn().mockImplementation((..._args) => ({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
          preconnect: vi.fn(),
        }));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        const result = await registeredTool.execute(
          "tool1",
          {
            query: "nonexistent-pkg-xyz-123",
          },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          "No packages found.",
        );
        expect(result.details.count).toBe(0);
      });
    });

    describe("given an HTTP request fails", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi.fn().mockImplementation((..._args) => ({
          ok: false,
          statusText: "Not Found",
          status: 404,
          preconnect: vi.fn(),
        }));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        const result = await registeredTool.execute(
          "tool1",
          { query: "test" },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Failed to search packages: Not Found",
        );
        expect(result.details.status).toBe(404);
      });

      it("then it should include the status text in the error", async () => {
        const mockFetch = vi.fn().mockImplementation((..._args) => ({
          ok: false,
          statusText: "Internal Server Error",
          status: 500,
          preconnect: vi.fn(),
        }));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        const result = await registeredTool.execute(
          "tool1",
          { query: "test" },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Failed to search packages: Internal Server Error",
        );
        expect(result.details.status).toBe(500);
      });
    });

    describe("given the fetch function throws an error", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        const result = await registeredTool.execute(
          "tool1",
          { query: "test" },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error searching packages: Network error",
        );
      });
    });
  });

  // ============================================
  // NPM Package Info
  // ============================================
  describe("npm-package-info", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "npm-package-info",
      )![0] as MockTool;
    });

    describe("given a valid package name", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockPackageData = {
          name: "express",
          description: "Fast, unopinionated, minimalist web framework",
          author: { name: "TJ Holowaychuk" },
          maintainers: [{ name: "TJ Holowaychuk" }, { name: "Douglas Wilson" }],
          homepage: "http://expressjs.com/",
          repository: {
            url: "git+https://github.com/expressjs/express.git",
          },
          keywords: ["express", "framework", "web", "http"],
          "dist-tags": { latest: "4.18.2" },
          versions: {
            "4.18.2": {
              license: "MIT",
              dependencies: { accepts: "~1.3.8", "array-flatten": "1.1.1" },
              devDependencies: { mocha: "^10.2.0" },
            },
          },
        };

        const mockFetch = vi.fn().mockImplementation((..._args) => ({
          ok: true,
          json: () => Promise.resolve(mockPackageData),
          preconnect: vi.fn(),
        }));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute(
          "tool1",
          {
            package: "express",
          },
          undefined,
          undefined,
          {} as any,
        );
      });

      it("then it should return formatted package info", () => {
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.package).toBe("express");
        expect((result.details.info as any).name).toBe("express");
        expect((result.details.info as any).license).toBe("MIT");
      });
    });

    describe("given a package that does not exist", () => {
      it("then it should return not found message", async () => {
        globalThis.fetch = createMockFetchNotFound();

        const result = await registeredTool.execute(
          "tool1",
          {
            package: "nonexistent-pkg-xyz-123",
          },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          'Package "nonexistent-pkg-xyz-123" not found.',
        );
        expect(result.details.status).toBe(404);
      });
    });

    describe("given an HTTP request returns server error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = createMockFetchServerError();

        const result = await registeredTool.execute(
          "tool1",
          {
            package: "lodash",
          },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Failed to get package info: Internal Server Error",
        );
        expect(result.details.status).toBe(500);
      });
    });

    describe("given the fetch function throws an error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = createMockFetchNetworkError();

        const result = await registeredTool.execute(
          "tool1",
          {
            package: "lodash",
          },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error get package info: Network error",
        );
      });
    });
  });

  // ============================================
  // NPM Package Versions
  // ============================================
  describe("npm-package-versions", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "npm-package-versions",
      )![0] as MockTool;
    });

    describe("given a valid package with multiple versions", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockPackageData = {
          name: "lodash",
          "dist-tags": { latest: "4.17.21", beta: "4.17.21-rc.1" },
          versions: {
            "4.17.21": {},
            "4.17.20": {},
            "4.17.21-rc.1": {},
          },
        };

        const mockFetch = vi.fn().mockImplementation((..._args) => ({
          ok: true,
          json: () => Promise.resolve(mockPackageData),
          preconnect: vi.fn(),
        }));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute(
          "tool1",
          {
            package: "lodash",
          },
          undefined,
          undefined,
          {} as any,
        );
      });

      it("then it should return formatted versions", () => {
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.package).toBe("lodash");
        expect(result.details.count).toBe(3);
      });
    });

    describe("given a package that does not exist", () => {
      it("then it should return not found message", async () => {
        globalThis.fetch = createMockFetchNotFound();

        const result = await registeredTool.execute(
          "tool1",
          {
            package: "nonexistent-pkg-xyz-123",
          },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          'Package "nonexistent-pkg-xyz-123" not found.',
        );
      });
    });

    describe("given an HTTP request returns server error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = createMockFetchServerError();

        const result = await registeredTool.execute(
          "tool1",
          {
            package: "lodash",
          },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Failed to get package versions: Internal Server Error",
        );
        expect(result.details.status).toBe(500);
      });
    });

    describe("given the fetch function throws an error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = createMockFetchNetworkError();

        const result = await registeredTool.execute(
          "tool1",
          {
            package: "lodash",
          },
          undefined,
          undefined,
          {} as any,
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error get package versions: Network error",
        );
      });
    });
  });
});
