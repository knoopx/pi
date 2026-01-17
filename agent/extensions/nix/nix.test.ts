import { describe, it, expect, beforeEach, vi } from "vitest";
import setupNixExtension from "./index";

describe("Nix Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
    };
    setupNixExtension(mockPi);
  });

  it("should register all nix tools", () => {
    const toolNames = [
      "search-nix-packages",
      "search-nix-options",
      "search-home-manager-options",
      "search-nixpkgs-pull-requests",
    ];

    toolNames.forEach((name) => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({ name }),
      );
    });
  });

  describe("search-nix-packages tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-nix-packages",
      )[0];
    });

    it("should search packages successfully", async () => {
      const mockPackages = [
        {
          package_attr_name: "hello",
          package_pname: "hello",
          package_pversion: "2.12.1",
          package_description: "A simple hello world program",
          package_longDescription: "GNU Hello prints a friendly greeting.",
          package_platforms: ["x86_64-linux", "aarch64-linux"],
          package_homepage: ["https://www.gnu.org/software/hello/"],
          package_maintainers: [{ name: "John Doe", github: "johndoe" }],
          package_license_set: ["GPL-3.0-or-later"],
        },
      ];

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({ hits: { hits: [{ _source: mockPackages[0] }] } }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { query: "hello" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://search.nixos.org/backend/latest-44-nixos-unstable/_search",
        {
          method: "POST",
          headers: expect.any(Object),
          body: expect.any(String),
        },
      );

      expect(result.content[0].text).toContain("Found 1 packages matching");
      expect(result.content[0].text).toContain("hello");
      expect(result.content[0].text).toContain("2.12.1");
      expect(result.details.query).toBe("hello");
      expect(result.details.totalFound).toBe(1);
    });

    it("should handle search errors", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await registeredTool.execute("tool1", { query: "test" });

      expect(result.content[0].text).toContain("Error: Network error");
    });

    it("should handle HTTP errors", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: false,
        status: 500,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { query: "test" });

      expect(result.content[0].text).toContain("Search request failed");
    });
  });

  describe("search-nix-options tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-nix-options",
      )[0];
    });

    it("should search options successfully", async () => {
      const mockOptions = [
        {
          option_name: "services.httpd.enable",
          option_description: "Whether to enable the Apache HTTP Server.",
          option_type: "boolean",
          option_default: "false",
          option_example: "true",
        },
      ];

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({ hits: { hits: [{ _source: mockOptions[0] }] } }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { query: "httpd" });

      expect(result.content[0].text).toContain("Found 1 options matching");
      expect(result.content[0].text).toContain("services.httpd.enable");
      expect(result.details.query).toBe("httpd");
    });
  });

  describe("search-home-manager-options tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-home-manager-options",
      )[0];
    });
    it("should search Home-Manager options successfully", async () => {
      const mockOptions = [
        {
          title: "programs.git.enable",
          description: "Whether to enable Git.",
          type: "boolean",
          default: "false",
          example: "true",
          declarations: [
            {
              url: "https://github.com/nix-community/home-manager/blob/master/modules/programs/git.nix",
            },
          ],
        },
      ];

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            last_update: "2024-01-01",
            options: mockOptions,
          }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { query: "git" });

      expect(result.content[0].text).toContain(
        "Found 1 Home-Manager options matching",
      );
      expect(result.content[0].text).toContain("programs.git.enable");
    });

    it("should filter options based on query", async () => {
      const mockOptions = [
        {
          title: "programs.git.enable",
          description: "Whether to enable Git.",
          type: "boolean",
          default: "false",
          example: "true",
          declarations: [],
        },
        {
          title: "programs.vim.enable",
          description: "Whether to enable Vim.",
          type: "boolean",
          default: "false",
          example: "true",
          declarations: [],
        },
      ];

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            last_update: "2024-01-01",
            options: mockOptions,
          }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { query: "git" });

      expect(result.content[0].text).toContain(
        "Found 1 Home-Manager options matching",
      );
      expect(result.content[0].text).toContain("programs.git.enable");
      expect(result.content[0].text).not.toContain("programs.vim.enable");
    });
  });

  describe("search-nixpkgs-pull-requests tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-nixpkgs-pull-requests",
      )[0];
    });

    it("should search pull requests successfully", async () => {
      const mockPRs = [
        {
          number: 12345,
          title: "Update hello to version 2.12.1",
          state: "open",
          user: { login: "contributor" },
          updated_at: "2024-01-01T00:00:00Z",
          html_url: "https://github.com/NixOS/nixpkgs/pull/12345",
          pull_request: true,
        },
      ];

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ items: mockPRs }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { query: "hello" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.github.com/search/issues"),
        expect.any(Object),
      );
      expect(result.content[0].text).toMatch(
        /Found \d+ pull requests matching/,
      );
      expect(result.content[0].text).toContain("Author: contributor");
    });

    it("should not display author when user is missing", async () => {
      const mockPRs = [
        {
          number: 12345,
          title: "Update hello to version 2.12.1",
          state: "open",
          user: null,
          updated_at: "2024-01-01T00:00:00Z",
          html_url: "https://github.com/NixOS/nixpkgs/pull/12345",
          pull_request: true,
        },
      ];

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ items: mockPRs }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", { query: "hello" });

      expect(result.content[0].text).toMatch(
        /Found \d+ pull requests matching/,
      );
      expect(result.content[0].text).not.toContain("Author:");
    });
  });
});
