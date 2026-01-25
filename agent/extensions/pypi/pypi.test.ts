import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import setupPyPIExtension from "./index";

describe("Scenario: PyPI Extension", () => {
  let mockPi: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      exec: vi.fn(),
    };
    originalFetch = globalThis.fetch;
    setupPyPIExtension(mockPi);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should register PyPI tools", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-pypi-packages",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "pypi-package-info",
      }),
    );
  });

  describe("Given search-pypi-packages tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-pypi-packages",
      )[0];
    });

    describe("when search returns valid HTML results", () => {
      let result: any;

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

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          text: async () => mockHtml,
        });

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

      it("then it should return packages in compact format", () => {
        expect(result.content[0].text).toBe("requests 2.31.0: Python HTTP for Humans.\nrequests-oauthlib 1.3.1: OAuthlib authentication support for Requests.");
        expect(result.details.query).toBe("requests");
        expect(result.details.total).toBe(2);
      });
    });

    describe("when search fails and fallback succeeds", () => {
      let result: any;

      beforeEach(async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              info: {
                name: "requests",
                version: "2.31.0",
                summary: "Python HTTP for Humans.",
              },
            }),
          });

        result = await registeredTool.execute("tool1", { query: "requests" });
      });

      it("then it should fallback to direct package lookup", () => {
        expect(result.content[0].text).toBe("requests 2.31.0: Python HTTP for Humans.");
        expect(result.details.total).toBe(1);
      });
    });

    describe("when search returns no results", () => {
      it("then it should return empty result message", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          text: async () => "<html></html>",
        });

        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => "<html></html>",
        }).mockResolvedValueOnce({
          ok: false,
        });

        const result = await registeredTool.execute("tool1", { query: "nonexistent-pkg-xyz-123" });

        expect(result.content[0].text).toContain('No packages found matching "nonexistent-pkg-xyz-123"');
      });
    });

    describe("when fetch throws an error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

        const result = await registeredTool.execute("tool1", { query: "requests" });

        expect(result.content[0].text).toBe("Failed to search packages: Error: Network error");
      });
    });
  });

  describe("Given pypi-package-info tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "pypi-package-info",
      )[0];
    });

    describe("when package exists on PyPI", () => {
      let result: any;

      beforeEach(async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
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
        });

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

      it("then it should return package in compact format", () => {
        expect(result.content[0].text).toBe("requests 2.31.0: Python HTTP for Humans. [Kenneth Reitz] Apache 2.0 https://requests.readthedocs.io/");
        expect(result.details.package).toBe("requests");
      });
    });

    describe("when package has many dependencies", () => {
      it("then it should truncate and show count", async () => {
        const requiresDist = Array.from({ length: 30 }, (_, i) => `dep${i}`);

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            info: {
              name: "big-package",
              version: "1.0.0",
              summary: "A package with many deps",
              requires_dist: requiresDist,
            },
          }),
        });

        const result = await registeredTool.execute("tool1", {
          package: "big-package",
        });

        expect(result.content[0].text).toContain("+10");
      });
    });

    describe("when package is not found on PyPI", () => {
      let result: any;

      beforeEach(async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        result = await registeredTool.execute("tool1", {
          package: "nonexistent-pkg-xyz-123",
        });
      });

      it("then it should return not found message", () => {
        expect(result.content[0].text).toContain('not found on PyPI');
        expect(result.details.package).toBe("nonexistent-pkg-xyz-123");
      });
    });

    describe("when HTTP request fails", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

        const result = await registeredTool.execute("tool1", {
          package: "requests",
        });

        expect(result.content[0].text).toBe("Error fetching package info: HTTP 500");
      });
    });

    describe("when fetch throws an error", () => {
      it("then it should return error message", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

        const result = await registeredTool.execute("tool1", {
          package: "requests",
        });

        expect(result.content[0].text).toBe("Failed to show package info: Error: Network error");
      });
    });
  });
});
