import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import setupPyPIExtension from "./index";
import type {
  MockTool,
  MockExtensionAPI,
} from "../../shared/testing/test-utils";
import { createMockExtensionAPI } from "../../shared/testing/test-utils";
import { disableThrottle } from "../../shared/network/throttle";

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
    });
  });

  describe("search-pypi-packages", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      const calls = mockPi.registerTool.mock.calls as [MockTool][];
      const found = calls.find((c) => c[0]?.name === "search-pypi-packages");
      if (!found) throw new Error("not found");
      registeredTool = found[0];
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
              text: () => Promise.resolve(mockHtml),
              preconnect: vi.fn(),
            }) as unknown,
        );

        result = await registeredTool.execute(
          "tool1",
          { query: "requests", limit: 5 },
          undefined,
          undefined,
          undefined,
        );
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
        expect((result.content[0] as TextContent).text).toMatchSnapshot();
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
            text: () =>
              Promise.resolve(`<html>
              <a class="package-snippet" href="/project/requests/">
                <span class="package-snippet__name">requests</span>
                <span class="package-snippet__version">2.31.0</span>
                <p class="package-snippet__description">Python HTTP for Humans.</p>
              </a>
            </html>`),
          } as unknown);
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute(
          "tool1",
          { query: "requests" },
          undefined,
          undefined,
          undefined,
        );
      });

      it("then it should fallback to direct package lookup", () => {
        expect((result.content[0] as TextContent).text).toMatchSnapshot();
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
                text: () =>
                  Promise.resolve(`<html>
                  <div class="search-page">
                    <div class="search-page__section">
                      <h2>No results found</h2>
                    </div>
                  </div>
                </html>`),
                preconnect: vi.fn(),
              }) as unknown,
          )
          .mockResolvedValueOnce({
            ok: false,
          });
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute(
          "tool1",
          { query: "nonexistent-pkg-xyz-123" },
          undefined,
          undefined,
          undefined,
        );
      });

      it("then it should return empty result message", () => {
        expect((result.content[0] as TextContent).text).toMatchSnapshot();
      });
    });
  });
});
