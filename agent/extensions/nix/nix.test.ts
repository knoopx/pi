import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import setupNixExtension from "./index";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

import { disableThrottle } from "../../shared/throttle";

/**
 * Helper to assert formatted option results
 */
function assertFormattedOptionResults(
  result: AgentToolResult<Record<string, unknown>>,
  query: string,
) {
  expect(stripAnsi((result.content[0] as TextContent).text)).toMatchSnapshot();
  expect(result.details.query).toBe(query);
  expect(result.details.totalFound).toBe(1);
}

// Extension Registration
describe("Nix Extension", () => {
  let mockPi: MockExtensionAPI;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    disableThrottle();
    mockPi = createMockExtensionAPI();
    originalFetch = globalThis.fetch;
    setupNixExtension(mockPi as unknown as ExtensionAPI);
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

  describe("search-nix-packages", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      const calls = mockPi.registerTool.mock.calls as [MockTool][];
      const found = calls.find((c) => c[0].name === "search-nix-packages");
      if (!found) throw new Error("not found");
      registeredTool = found[0];
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

        result = await registeredTool.execute(
          "tool1",
          { query: "hello" },
          undefined,
          undefined,
          {},
        );
      });

      it("then it should return formatted package results", () => {
        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
        expect(result.details.query).toBe("hello");
        expect(result.details.totalFound).toBe(1);
      });
    });

    describe("given a network error occurs", () => {
      it("then it should return error message", async () => {
        const mockFetch = vi
          .fn()
          .mockRejectedValue(new Error("Network error")) as unknown;
        globalThis.fetch = mockFetch as typeof globalThis.fetch;

        const result = await registeredTool.execute(
          "tool1",
          { query: "test" },
          undefined,
          undefined,
          {},
        );

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
              status: 500,
              preconnect: vi.fn(),
            }) as unknown,
        );
        globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

        const result = await registeredTool.execute(
          "tool1",
          { query: "test" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toMatch(
          /^Error: HTTP \d+ from Nix search API$/,
        );
      });
    });
  });

  describe("search-nix-options", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      const calls = mockPi.registerTool.mock.calls as [MockTool][];
      const found = calls.find((c) => c[0].name === "search-nix-options");
      if (!found) throw new Error("not found");
      registeredTool = found[0];
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
        globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

        result = await registeredTool.execute(
          "tool1",
          { query: "httpd" },
          undefined,
          undefined,
          {},
        );
      });

      it("then it should return formatted option results", () => {
        assertFormattedOptionResults(result, "httpd");
      });
    });
  });

  describe("search-home-manager-options", () => {
    let registeredTool: MockTool;

    beforeEach(() => {
      const calls = mockPi.registerTool.mock.calls as [MockTool][];
      const found = calls.find(
        (c) => c[0].name === "search-home-manager-options",
      );
      if (!found) throw new Error("not found");
      registeredTool = found[0];
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
        globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

        result = await registeredTool.execute(
          "tool1",
          { query: "git" },
          undefined,
          undefined,
          {},
        );
      });

      it("then it should return formatted option results", () => {
        assertFormattedOptionResults(result, "git");
      });
    });
  });
});
