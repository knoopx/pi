import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import setupNpmExtension from "./index";

describe("Scenario: NPM Extension", () => {
  let mockPi: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      exec: vi.fn(),
    };
    originalFetch = globalThis.fetch;
    setupNpmExtension(mockPi);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should register npm tools", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-npm-packages",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "npm-package-info",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "npm-package-versions",
      }),
    );
  });

  describe("Given search-npm-packages tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-npm-packages",
      )[0];
    });

    describe("when searching for packages", () => {
      let result: any;

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

        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: true,
          json: () => Promise.resolve(mockResponseData),
        };
        mockFetch.mockResolvedValue(mockResponse);

        result = await registeredTool.execute("tool1", {
          query: "lodash",
          size: 1,
        });
      });

      it("then it should return formatted search results", () => {
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe("text");
        expect(result.content[0].text).toBe("lodash 4.17.21: A modern JavaScript utility library [John-David Dalton] util,functional,server,client,browser");
        expect(result.details.query).toBe("lodash");
        expect(result.details.count).toBe(1);
      });
    });

    describe("when size is not provided", () => {
      it("then it should use default size of 10", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        };
        mockFetch.mockResolvedValue(mockResponse);

        await registeredTool.execute("tool1", { query: "test" });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("size=10"),
        );
      });
    });

    describe("when no packages are found", () => {
      it("then it should return no packages found message", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        };
        mockFetch.mockResolvedValue(mockResponse);

        const result = await registeredTool.execute("tool1", {
          query: "nonexistent-pkg-xyz-123",
        });

        expect(result.content[0].text).toBe("No packages found.");
        expect(result.details.count).toBe(0);
      });
    });

    describe("when HTTP request fails", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: false,
          statusText: "Not Found",
          status: 404,
        };
        mockFetch.mockResolvedValue(mockResponse);

        const result = await registeredTool.execute("tool1", { query: "test" });

        expect(result.content[0].text).toBe("Failed to search packages: Not Found");
        expect(result.details.status).toBe(404);
      });
    });
  });

  describe("Given npm-package-info tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "npm-package-info",
      )[0];
    });

    describe("when fetching package info", () => {
      let result: any;

      beforeEach(async () => {
        const mockPackageData = {
          name: "express",
          description: "Fast, unopinionated, minimalist web framework",
          author: { name: "TJ Holowaychuk" },
          maintainers: [{ name: "TJ Holowaychuk" }, { name: "Douglas Wilson" }],
          homepage: "http://expressjs.com/",
          repository: { url: "git+https://github.com/expressjs/express.git" },
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

        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: true,
          json: () => Promise.resolve(mockPackageData),
        };
        mockFetch.mockResolvedValue(mockResponse);

        result = await registeredTool.execute("tool1", {
          package: "express",
        });
      });

      it("then it should return formatted package info", () => {
        expect(result.content[0].text).toBe("express 4.18.2: Fast, unopinionated, minimalist web framework [TJ Holowaychuk] MIT http://expressjs.com/ git+https://github.com/expressjs/express.git express, framework, web, http 2 1");
        expect(result.details.package).toBe("express");
        expect(result.details.info.name).toBe("express");
        expect(result.details.info.license).toBe("MIT");
      });
    });

    describe("when package is not found", () => {
      it("then it should return not found message", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: false,
          status: 404,
        };
        mockFetch.mockResolvedValue(mockResponse);

        const result = await registeredTool.execute("tool1", {
          package: "nonexistent-pkg-xyz-123",
        });

        expect(result.content[0].text).toContain("not found.");
        expect(result.details.status).toBe(404);
      });
    });

    describe("when HTTP request fails", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: false,
          statusText: "Internal Server Error",
          status: 500,
        };
        mockFetch.mockResolvedValue(mockResponse);

        const result = await registeredTool.execute("tool1", { package: "test" });

        expect(result.content[0].text).toBe("Failed to get package info: Internal Server Error");
        expect(result.details.status).toBe(500);
      });
    });
  });

  describe("Given npm-package-versions tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "npm-package-versions",
      )[0];
    });

    describe("when fetching package versions", () => {
      let result: any;

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

        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: true,
          json: () => Promise.resolve(mockPackageData),
        };
        mockFetch.mockResolvedValue(mockResponse);

        result = await registeredTool.execute("tool1", {
          package: "lodash",
        });
      });

      it("then it should return formatted versions", () => {
        expect(result.content[0].text).toBe("lodash 3 versions latest:4.17.21,beta:4.17.21-rc.1 4.17.21,4.17.20,4.17.21-rc.1");
        expect(result.details.package).toBe("lodash");
        expect(result.details.count).toBe(3);
      });
    });

    describe("when package is not found", () => {
      it("then it should return not found message", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: false,
          status: 404,
        };
        mockFetch.mockResolvedValue(mockResponse);

        const result = await registeredTool.execute("tool1", {
          package: "nonexistent-pkg-xyz-123",
        });

        expect(result.content[0].text).toContain("not found.");
        expect(result.details.status).toBe(404);
      });
    });
  });
});
