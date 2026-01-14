import { describe, it, expect, beforeEach, vi } from "vitest";
import setupNpmExtension from "./index";

describe("NPM Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
    };
    setupNpmExtension(mockPi);
  });

  it("should register npm tools", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-npm-packages",
        label: "Search NPM Packages",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "npm-package-info",
        label: "NPM Package Info",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "npm-package-versions",
        label: "NPM Package Versions",
      }),
    );
  });

  describe("search-npm-packages tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-npm-packages",
      )[0];
    });

    it("should search packages successfully", async () => {
      const mockResponseData = {
        objects: [
          {
            package: {
              name: "lodash",
              version: "4.17.21",
              description: "A modern JavaScript utility library",
              keywords: ["util", "functional", "server", "client", "browser"],
              author: { name: "John-David Dalton" },
              date: "2021-01-01",
              links: { npm: "https://www.npmjs.com/package/lodash" },
            },
          },
        ],
      };

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockResponseData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        query: "lodash",
        size: 5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/-/v1/search?text=lodash&size=5",
      );
      expect(result.content[0].text).toContain("**lodash** (4.17.21)");
      expect(result.content[0].text).toContain(
        "A modern JavaScript utility library",
      );
      expect(result.content[0].text).toContain("Author: John-David Dalton");
    });

    it("should use default size when not provided", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await registeredTool.execute("tool1", { query: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/-/v1/search?text=test&size=10",
      );
    });

    it("should handle no packages found", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        query: "nonexistent",
      });

      expect(result.content[0].text).toBe("No packages found.");
    });

    it("should handle HTTP errors", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: false,
        statusText: "Internal Server Error",
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { query: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to search packages");
    });
  });

  describe("npm-package-info tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "npm-package-info",
      )[0];
    });

    it("should get package info successfully", async () => {
      const mockPackageData = {
        name: "express",
        description: "Fast, unopinionated, minimalist web framework",
        author: { name: "TJ Holowaychuk" },
        maintainers: [{ name: "TJ Holowaychuk" }, { name: "Douglas Wilson" }],
        homepage: "http://expressjs.com/",
        repository: { url: "git+https://github.com/expressjs/express.git" },
        "dist-tags": { latest: "4.18.2" },
        versions: {
          "4.18.2": {
            license: "MIT",
            dependencies: { accepts: "~1.3.8", "array-flatten": "1.1.1" },
            devDependencies: { mocha: "^10.2.0" },
          },
        },
        keywords: ["express", "framework", "web", "http"],
      };

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockPackageData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        package: "express",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/express",
      );
      expect(result.content[0].text).toContain("**express**");
      expect(result.content[0].text).toContain(
        "Fast, unopinionated, minimalist web framework",
      );
      expect(result.content[0].text).toContain("**Latest Version:** 4.18.2");
      expect(result.content[0].text).toContain("**License:** MIT");
    });

    it("should handle package not found", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        package: "nonexistent-package",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Package "nonexistent-package" not found.',
      );
    });

    it("should handle HTTP errors", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { package: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to get package info");
    });
  });

  describe("npm-package-versions tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "npm-package-versions",
      )[0];
    });

    it("should get package versions successfully", async () => {
      const mockPackageData = {
        name: "lodash",
        "dist-tags": {
          latest: "4.17.21",
          beta: "4.17.21-rc.1",
        },
        versions: {
          "4.17.21": { time: "2021-01-01T00:00:00.000Z" },
          "4.17.20": { time: "2020-12-01T00:00:00.000Z" },
          "4.17.21-rc.1": { time: "2020-12-15T00:00:00.000Z" },
        },
      };

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockPackageData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        package: "lodash",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/lodash",
      );
      expect(result.content[0].text).toContain("**lodash Versions**");
      expect(result.content[0].text).toContain("**Dist Tags:**");
      expect(result.content[0].text).toContain("- latest: 4.17.21");
      expect(result.content[0].text).toContain("- beta: 4.17.21-rc.1");
      expect(result.content[0].text).toContain(
        "**All Versions (latest first):**",
      );
      expect(result.content[0].text).toContain("4.17.21");
      expect(result.content[0].text).toContain("4.17.20");
    });

    it("should handle package not found", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        package: "nonexistent",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Package "nonexistent" not found.',
      );
    });
  });
});
