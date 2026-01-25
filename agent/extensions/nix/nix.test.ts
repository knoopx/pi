import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import setupNixExtension from "./index";

describe("Scenario: Nix Extension", () => {
  let mockPi: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
    };
    originalFetch = globalThis.fetch;
    setupNixExtension(mockPi);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should register all nix tools", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-nix-packages",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-nix-options",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-home-manager-options",
      }),
    );
  });

  describe("Given search-nix-packages tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-nix-packages",
      )[0];
    });

    describe("when searching for packages", () => {
      let result: any;

      beforeEach(async () => {
        const mockPackages = [
          {
            type: "package",
            package_attr_name: "hello",
            package_pname: "hello",
            package_pversion: "2.12.1",
            package_description: "A simple hello world program",
            package_longDescription:
              "GNU Hello prints a friendly greeting.",
            package_homepage: ["https://www.gnu.org/software/hello/"],
            package_maintainers: [{ name: "John Doe" }],
            package_license_set: ["GPL-3.0-or-later"],
          },
        ];

        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: true,
          json: () =>
            Promise.resolve({
              hits: { hits: mockPackages.map((p) => ({ _source: p })) },
            }),
        };
        mockFetch.mockResolvedValue(mockResponse);

        result = await registeredTool.execute("tool1", { query: "hello" });
      });

      it("then it should return formatted package results", () => {
        expect(result.content[0].text).toBe("hello hello 2.12.1: A simple hello world program [John Doe] GNU Hello prints a friendly greeting. https://www.gnu.org/software/hello/ GPL-3.0-or-later");
        expect(result.details.query).toBe("hello");
        expect(result.details.totalFound).toBe(1);
      });
    });

    describe("when search throws an error", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;
        mockFetch.mockRejectedValue(new Error("Network error"));

        const result = await registeredTool.execute("tool1", { query: "test" });

        expect(result.content[0].text).toBe("Error: Network error");
      });
    });

    describe("when HTTP request fails", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: false,
        };
        mockFetch.mockResolvedValue(mockResponse);

        const result = await registeredTool.execute("tool1", { query: "test" });

        expect(result.content[0].text).toBe("Error: Search request failed: undefined");
      });
    });
  });

  describe("Given search-nix-options tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-nix-options",
      )[0];
    });

    describe("when searching for options", () => {
      let result: any;

      beforeEach(async () => {
        const mockOptions = [
          {
            type: "option",
            option_name: "services.httpd.enable",
            option_description:
              "Whether to enable the Apache HTTP Server.",
            option_type: "boolean",
            option_default: "false",
            option_example: "true",
          },
        ];

        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: true,
          json: () =>
            Promise.resolve({
              hits: { hits: mockOptions.map((o) => ({ _source: o })) },
            }),
        };
        mockFetch.mockResolvedValue(mockResponse);

        result = await registeredTool.execute("tool1", { query: "httpd" });
      });

      it("then it should return formatted option results", () => {
        expect(result.content[0].text).toBe("services.httpd.enable: Whether to enable the Apache HTTP Server. boolean false true");
        expect(result.details.query).toBe("httpd");
        expect(result.details.totalFound).toBe(1);
      });
    });
  });

  describe("Given search-home-manager-options tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-home-manager-options",
      )[0];
    });

    describe("when searching for Home Manager options", () => {
      let result: any;

      beforeEach(async () => {
        const mockOptions = [
          {
            title: "programs.git.enable",
            description: "Whether to enable Git.",
            type: "boolean",
            default: "false",
            example: "true",
            declarations: [
              {
                name: "programs.git.enable",
                url: "https://github.com/nix-community/home-manager/blob/master/modules/programs/git.nix",
              },
            ],
          },
          {
            title: "programs.vim.enable",
            description: "Whether to enable Vim.",
            type: "boolean",
            default: "false",
            example: "true",
            declarations: [
              {
                name: "programs.vim.enable",
                url: "https://github.com/nix-community/home-manager/blob/master/modules/programs/vim.nix",
              },
            ],
          },
        ];

        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const mockResponse = {
          ok: true,
          json: () =>
            Promise.resolve({
              last_update: "2024-01-01",
              options: mockOptions,
            }),
        };
        mockFetch.mockResolvedValue(mockResponse);

        result = await registeredTool.execute("tool1", { query: "git" });
      });

      it("then it should filter and return matching options", () => {
        expect(result.content[0].text).toBe("programs.git.enable: Whether to enable Git. boolean false true https://github.com/nix-community/home-manager/blob/master/modules/programs/git.nix");
        expect(result.details.query).toBe("git");
        expect(result.details.totalFound).toBe(1);
      });
    });
  });
});
