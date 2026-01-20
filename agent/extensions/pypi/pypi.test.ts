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
    // Save original fetch
    originalFetch = globalThis.fetch;
    setupPyPIExtension(mockPi);
  });

  afterEach(() => {
    // Restore original fetch
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

    it("should search packages via HTML scraping", async () => {
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

      const result = await registeredTool.execute("tool1", {
        query: "requests",
        limit: 5,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://pypi.org/search/?q=requests&o=",
        expect.objectContaining({
          headers: { Accept: "application/vnd.pypi.simple.v1+json" },
        }),
      );
      expect(result.content[0].text).toContain("Found 2 package(s) matching");
      expect(result.content[0].text).toContain("**requests** (2.31.0)");
      expect(result.content[0].text).toContain("Python HTTP for Humans.");
      expect(result.details.query).toBe("requests");
      expect(result.details.total).toBe(2);
    });

    it("should fallback to direct lookup when search fails", async () => {
      const mockFetch = vi.fn();
      // First call (search) fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Second call (direct lookup) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: {
            name: "requests",
            version: "2.31.0",
            summary: "Python HTTP for Humans.",
          },
        }),
      });

      globalThis.fetch = mockFetch;

      const result = await registeredTool.execute("tool1", {
        query: "requests",
      });

      expect(result.content[0].text).toContain("Found 1 package matching");
      expect(result.content[0].text).toContain("**requests** (2.31.0)");
    });

    it("should handle no results", async () => {
      const mockFetch = vi.fn();
      // Search returns empty HTML
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><body>No results</body></html>",
      });

      // Direct lookup also fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      globalThis.fetch = mockFetch;

      const result = await registeredTool.execute("tool1", {
        query: "nonexistent-package-xyz",
      });

      expect(result.content[0].text).toContain("No packages found matching");
    });

    it("should handle fetch errors", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"));

      const result = await registeredTool.execute("tool1", { query: "test" });

      expect(result.content[0].text).toContain("Failed to search packages");
      expect(result.content[0].text).toContain("Network error");
    });
  });

  describe("Given pypi-package-info tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "pypi-package-info",
      )[0];
    });

    it("should show package info from PyPI API", async () => {
      const mockPackageInfo = {
        info: {
          name: "requests",
          version: "2.31.0",
          summary: "Python HTTP for Humans.",
          home_page: "https://requests.readthedocs.io/",
          author: "Kenneth Reitz",
          author_email: "me@kennethreitz.org",
          license: "Apache 2.0",
          requires_python: ">=3.7",
          requires_dist: ["urllib3", "certifi", "charset-normalizer", "idna"],
          project_urls: {
            Documentation: "https://requests.readthedocs.io/",
            Source: "https://github.com/psf/requests",
          },
          keywords: "http client",
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackageInfo,
      });

      const result = await registeredTool.execute("tool1", {
        package: "requests",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://pypi.org/pypi/requests/json",
        expect.objectContaining({ signal: undefined }),
      );
      expect(result.content[0].text).toContain("Package: requests");
      expect(result.content[0].text).toContain("**Version:** 2.31.0");
      expect(result.content[0].text).toContain(
        "**Summary:** Python HTTP for Humans.",
      );
      expect(result.content[0].text).toContain("**Author:** Kenneth Reitz");
      expect(result.content[0].text).toContain("**License:** Apache 2.0");
      expect(result.content[0].text).toContain(
        "**Dependencies:** urllib3, certifi, charset-normalizer, idna",
      );
      expect(result.content[0].text).toContain("**Project URLs:**");
      expect(result.details.package).toBe("requests");
    });

    it("should handle package not found on PyPI", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await registeredTool.execute("tool1", {
        package: "nonexistent-package",
      });

      expect(result.content[0].text).toContain(
        'Package "nonexistent-package" not found on PyPI.',
      );
    });

    it("should handle HTTP errors", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await registeredTool.execute("tool1", {
        package: "requests",
      });

      expect(result.content[0].text).toContain(
        "Error fetching package info: HTTP 500",
      );
    });

    it("should handle fetch errors", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"));

      const result = await registeredTool.execute("tool1", {
        package: "requests",
      });

      expect(result.content[0].text).toContain("Failed to show package info");
      expect(result.content[0].text).toContain("Network error");
    });

    it("should handle packages with many dependencies", async () => {
      const manyDeps = Array.from({ length: 30 }, (_, i) => `dep${i}`);
      const mockPackageInfo = {
        info: {
          name: "big-package",
          version: "1.0.0",
          summary: "A package with many deps",
          requires_dist: manyDeps,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackageInfo,
      });

      const result = await registeredTool.execute("tool1", {
        package: "big-package",
      });

      expect(result.content[0].text).toContain("... and 10 more");
    });
  });
});
