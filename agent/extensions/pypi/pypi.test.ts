// @ts-nocheck — test calls use incorrect arity/types; needs execute signature migration
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import setupPyPIExtension from "./index";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

import { disableThrottle } from "../../shared/throttle";

describe("PyPI Extension", () => {
  let mockPi: MockExtensionAPI;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    disableThrottle();
    mockPi = createMockExtensionAPI();
    originalFetch = globalThis.fetch;
    setupPyPIExtension(mockPi as ExtensionAPI);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("given the extension is initialized", () => {
    describe("when registering tools", () => {
      it("then it should register PyPI search tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "search-pypi-packages",
          }),
        );
      });

      it("then it should register PyPI package info tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "pypi-package-info",
          }),
        );
      });
    });
  });

  describe("search-pypi-packages", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "search-pypi-packages",
      )![0] as MockTool;
    });

    describe("given a valid search query with HTML results", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockHtml = `
          <a class="package-snippet" href="/project/requests/">
            <span class="package-snippet__name">requests</span>
            <span class="package-snippet__version">2.31.0</span>
            <p class="package-snippet__description">Python HTTP for Humans.</p>
          </a>
          <a class="package-snippet" href="/project/requests-oauthlib/">
            <span class="package-snippet__name">requests-oauthlib</span>
            <span class="package-snippet__version">1.3.1</span>
            <p class="package-snippet__description">OAuthlib authentication support for Requests.</p>
          </a>
        `;

        globalThis.fetch = vi.fn().mockImplementation(
          (..._args) =>
            ({
              ok: true,
              text: async () => mockHtml,
              preconnect: vi.fn(),
            }) as unknown,
        );

        result = await registeredTool.execute("tool1", {
          query: "requests",
          limit: 5,
        });
      });

      it("then it should call PyPI search endpoint", () => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          "https://pypi.org/search/?q=requests&o=",
          expect.objectContaining({
            headers: { Accept: "application/vnd.pypi.simple.v1+json" },
          }),
        );
      });

      it("then it should return formatted search results", () => {
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.query).toBe("requests");
        expect(result.details.total).toBe(2);
      });
    });

    describe("given search fails and fallback succeeds", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockFetch = vi
          .fn()
          .mockImplementation((..._args) => ({
            ok: false,
            preconnect: vi.fn(),
          }))
          .mockResolvedValueOnce({
            ok: true,
            text: async () => `<html>
              <a class="package-snippet" href="/project/requests/">
                <span class="package-snippet__name">requests</span>
                <span class="package-snippet__version">2.31.0</span>
                <p class="package-snippet__description">Python HTTP for Humans.</p>
              </a>
            </html>`,
          } as unknown);
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute("tool1", { query: "requests" });
      });

      it("then it should fallback to direct package lookup", () => {
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.total).toBe(1);
      });
    });

    describe("given search returns no results", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockFetch = vi
          .fn()
          .mockImplementation(
            (..._args) =>
              ({
                ok: true,
                text: async () => `<html>
                  <div class="search-page">
                    <div class="search-page__section">
                      <h2>No results found</h2>
                    </div>
                  </div>
                </html>`,
                preconnect: vi.fn(),
              }) as unknown,
          )
          .mockResolvedValueOnce({
            ok: false,
          });
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute("tool1", {
          query: "nonexistent-pkg-xyz-123",
        });
      });

      it("then it should return empty result message", () => {
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
      });
    });
  });

  // PyPI Package Info
  describe("pypi-package-info", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "pypi-package-info",
      )![0] as MockTool;
    });

    describe("given a valid package on PyPI", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        globalThis.fetch = vi.fn().mockImplementation(
          (..._args) =>
            ({
              ok: true,
              json: async () => ({
                info: {
                  name: "requests",
                  version: "2.31.0",
                  summary: "Python HTTP for Humans.",
                  home_page: "https://requests.readthedocs.io/",
                  author: "Kenneth Reitz",
                  license: "Apache 2.0",
                },
              }),
              preconnect: vi.fn(),
            }) as unknown,
        );

        result = await registeredTool.execute("tool1", {
          package: "requests",
        });
      });

      it("then it should fetch package info from PyPI", () => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          "https://pypi.org/pypi/requests/json",
          expect.objectContaining({ signal: undefined }),
        );
      });

      it("then it should return formatted package info", () => {
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.package).toBe("requests");
      });
    });

    describe("given a package with many dependencies", () => {
      it("then it should truncate and show count", async () => {
        const requiresDist = Array.from({ length: 30 }, (_, i) => `dep${i}`);

        globalThis.fetch = vi.fn().mockImplementation(
          (..._args) =>
            ({
              ok: true,
              json: async () => ({
                info: {
                  name: "big-package",
                  version: "1.0.0",
                  summary: "A package with many deps",
                  requires_dist: requiresDist,
                },
              }),
              preconnect: vi.fn(),
            }) as unknown,
        );

        const result = await registeredTool.execute("tool1", {
          package: "big-package",
        });

        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
      });
    });

    describe("given a package that does not exist on PyPI", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        globalThis.fetch = vi.fn().mockImplementation(
          (..._args) =>
            ({
              ok: false,
              status: 404,
              preconnect: vi.fn(),
            }) as unknown,
        );

        result = await registeredTool.execute("tool1", {
          package: "nonexistent-pkg-xyz-123",
        });
      });

      it("then it should return not found message", () => {
        expect((result.content[0] as TextContent).text).toBe(
          'Package "nonexistent-pkg-xyz-123" not found on PyPI.',
        );
        expect(result.details.package).toBe("nonexistent-pkg-xyz-123");
      });
    });

    describe("given an HTTP request returns server error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = vi.fn().mockImplementation(
          (..._args) =>
            ({
              ok: false,
              status: 500,
              statusText: "Internal Server Error",
              preconnect: vi.fn(),
            }) as unknown,
        );

        const result = await registeredTool.execute("tool1", {
          package: "requests",
        });

        expect((result.content[0] as TextContent).text).toBe(
          "Error fetching package info: HTTP 500",
        );
      });
    });

    describe("given fetch throws a network error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = vi
          .fn()
          .mockRejectedValue(new Error("Network error"));

        const result = await registeredTool.execute("tool1", {
          package: "requests",
        });

        expect((result.content[0] as TextContent).text).toBe(
          "Failed to show package info: Error: Network error",
        );
      });
    });

    describe("given fetch throws a generic error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = vi
          .fn()
          .mockRejectedValue(new Error("Something went wrong"));

        const result = await registeredTool.execute("tool1", {
          package: "requests",
        });

        expect((result.content[0] as TextContent).text).toBe(
          "Failed to show package info: Error: Something went wrong",
        );
      });
    });
  });
});
