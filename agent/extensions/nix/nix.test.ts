// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import setupNixExtension from "./index";
import type { MockTool, MockExtensionAPI } from "../../test-utils";
import { createMockExtensionAPI } from "../../test-utils";

// ============================================
// Extension Registration
// ============================================
describe("Nix Extension", () => {
  let mockPi: MockExtensionAPI;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    originalFetch = globalThis.fetch;
    setupNixExtension(mockPi as ExtensionAPI);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("given the extension is initialized", () => {
    describe("when registering tools", () => {
      it("then it should register nix packages search tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "search-nix-packages",
          }),
        );
      });

      it("then it should register nix options search tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "search-nix-options",
          }),
        );
      });

      it("then it should register home manager options search tool", () => {
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "search-home-manager-options",
          }),
        );
      });
    });
  });

  // ============================================
  // Search Nix Packages
  // ============================================
  describe("search-nix-packages", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "search-nix-packages",
      )![0] as MockTool;
    });

    describe("given a valid package query", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockPackages = [
          {
            type: "package",
            package_attr_name: "hello",
            package_pname: "hello",
            package_pversion: "2.12.1",
            package_description: "A simple hello world program",
            package_longDescription: "GNU Hello prints a friendly greeting.",
            package_homepage: ["https://www.gnu.org/software/hello/"],
            package_maintainers: [{ name: "John Doe" }],
            package_license_set: ["GPL-3.0-or-later"],
          },
        ];

        const mockFetch: unknown = vi.fn().mockImplementation((..._args) => ({
          ok: true,
          json: () =>
            Promise.resolve({
              hits: { hits: mockPackages.map((p) => ({ _source: p })) },
            }),
          preconnect: vi.fn(),
        }));
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute("tool1", { query: "hello" });
      });

      it("then it should return formatted package results", () => {
        expect((result.content[0] as TextContent).text).toBe(
          "hello hello 2.12.1: A simple hello world program [John Doe] GNU Hello prints a friendly greeting. https://www.gnu.org/software/hello/ GPL-3.0-or-later",
        );
        expect(result.details.query).toBe("hello");
        expect(result.details.totalFound).toBe(1);
      });

      it("then it should include the package name", () => {
        expect((result.content[0] as TextContent).text).toContain("hello");
      });

      it("then it should include the package version", () => {
        expect((result.content[0] as TextContent).text).toContain("2.12.1");
      });

      it("then it should include the package description", () => {
        expect((result.content[0] as TextContent).text).toContain(
          "A simple hello world program",
        );
      });

      it("then it should include the maintainer name", () => {
        expect((result.content[0] as TextContent).text).toContain("John Doe");
      });

      it("then it should include the license information", () => {
        expect((result.content[0] as TextContent).text).toContain(
          "GPL-3.0-or-later",
        );
      });
    });

    describe("given a network error occurs", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi
          .fn()
          .mockRejectedValue(new Error("Network error")) as unknown;
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        const result = await registeredTool.execute("tool1", { query: "test" });

        expect((result.content[0] as TextContent).text).toBe(
          "Error: Network error",
        );
      });
    });

    describe("given an HTTP request returns error", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi.fn().mockImplementation(
          (..._args) =>
            ({
              ok: false,
              preconnect: vi.fn(),
            }) as unknown,
        );
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        const result = await registeredTool.execute("tool1", { query: "test" });

        expect((result.content[0] as TextContent).text).toBe(
          "Error: Search request failed: undefined",
        );
      });
    });
  });

  // ============================================
  // Search Nix Options
  // ============================================
  describe("search-nix-options", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "search-nix-options",
      )![0] as MockTool;
    });

    describe("given a valid option query", () => {
      let result: AgentToolResult<Record<string, unknown>>;

      beforeEach(async () => {
        const mockOptions = [
          {
            type: "option",
            option_name: "services.httpd.enable",
            option_description: "Whether to enable the Apache HTTP Server.",
            option_type: "boolean",
            option_default: "false",
            option_example: "true",
          },
        ];

        const mockFetch = vi.fn().mockImplementation(
          (..._args) =>
            ({
              ok: true,
              json: () =>
                Promise.resolve({
                  hits: { hits: mockOptions.map((o) => ({ _source: o })) },
                }),
              preconnect: vi.fn(),
            }) as unknown,
        );
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute("tool1", { query: "httpd" });
      });

      it("then it should return formatted option results", () => {
        expect((result.content[0] as TextContent).text).toBe(
          "services.httpd.enable: Whether to enable the Apache HTTP Server. boolean false true",
        );
        expect(result.details.query).toBe("httpd");
        expect(result.details.totalFound).toBe(1);
      });

      it("then it should include the option name", () => {
        expect((result.content[0] as TextContent).text).toContain(
          "services.httpd.enable",
        );
      });

      it("then it should include the option description", () => {
        expect((result.content[0] as TextContent).text).toContain(
          "Whether to enable the Apache HTTP Server.",
        );
      });

      it("then it should include the option type", () => {
        expect((result.content[0] as TextContent).text).toContain("boolean");
      });

      it("then it should include the default value", () => {
        expect((result.content[0] as TextContent).text).toContain("false");
      });

      it("then it should include the example value", () => {
        expect((result.content[0] as TextContent).text).toContain("true");
      });
    });
  });

  // ============================================
  // Search Home Manager Options
  // ============================================
  describe("search-home-manager-options", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "search-home-manager-options",
      )![0] as MockTool;
    });

    describe("given a valid Home Manager option query", () => {
      let result: AgentToolResult<Record<string, unknown>>;

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

        const mockFetch = vi.fn().mockImplementation(
          (..._args) =>
            ({
              ok: true,
              json: () =>
                Promise.resolve({
                  last_update: "2024-01-01",
                  options: mockOptions,
                }),
              preconnect: vi.fn(),
            }) as unknown,
        );
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        result = await registeredTool.execute("tool1", { query: "git" });
      });

      it("then it should return formatted option results", () => {
        expect((result.content[0] as TextContent).text).toBe(
          "programs.git.enable: Whether to enable Git. boolean false true https://github.com/nix-community/home-manager/blob/master/modules/programs/git.nix",
        );
        expect(result.details.query).toBe("git");
        expect(result.details.totalFound).toBe(1);
      });

      it("then it should include the option title", () => {
        expect((result.content[0] as TextContent).text).toContain(
          "programs.git.enable",
        );
      });

      it("then it should include the option description", () => {
        expect((result.content[0] as TextContent).text).toContain(
          "Whether to enable Git.",
        );
      });

      it("then it should include the option type", () => {
        expect((result.content[0] as TextContent).text).toContain("boolean");
      });

      it("then it should include the default value", () => {
        expect((result.content[0] as TextContent).text).toContain("false");
      });

      it("then it should include the example value", () => {
        expect((result.content[0] as TextContent).text).toContain("true");
      });

      it("then it should include the declaration URL", () => {
        expect((result.content[0] as TextContent).text).toContain(
          "https://github.com/nix-community/home-manager/blob/master/modules/programs/git.nix",
        );
      });
    });
  });
});
