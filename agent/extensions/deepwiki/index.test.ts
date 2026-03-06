import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import setupDeepwikiExtension from "./index";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";
import { disableThrottle } from "../../shared/throttle";

describe("DeepWiki Extension", () => {
  let mockPi: MockExtensionAPI;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    disableThrottle();
    mockPi = createMockExtensionAPI();
    originalFetch = globalThis.fetch;
    setupDeepwikiExtension(mockPi as unknown as ExtensionAPI);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("given the extension is initialized", () => {
    it("then it should register deepwiki-read-structure tool", () => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "deepwiki-read-structure" }),
      );
    });

    it("then it should register deepwiki-read-contents tool", () => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "deepwiki-read-contents" }),
      );
    });

    it("then it should register deepwiki-ask tool", () => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "deepwiki-ask" }),
      );
    });
  });

  describe("deepwiki-read-structure", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "deepwiki-read-structure",
      )![0] as MockTool;
    });

    describe("given a successful MCP response", () => {
      it("then it should return wiki structure text", async () => {
        const mcpResponse = {
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [
              { type: "text", text: "# Architecture\n## Components\n## API" },
            ],
          },
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: async () => `data: ${JSON.stringify(mcpResponse)}`,
        }) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          { repoName: "facebook/react" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "# Architecture\n## Components\n## API",
        );
        expect(result.details.repoName).toBe("facebook/react");
      });
    });

    describe("given an HTTP error", () => {
      it("then it should return error result", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        }) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          { repoName: "facebook/react" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error: MCP request failed: 500 Internal Server Error",
        );
        expect(result.details.repoName).toBe("facebook/react");
      });
    });

    describe("given a network error", () => {
      it("then it should return error result", async () => {
        globalThis.fetch = vi
          .fn()
          .mockRejectedValue(
            new Error("Network error"),
          ) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          { repoName: "facebook/react" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error: Network error",
        );
      });
    });

    describe("given an MCP error response", () => {
      it("then it should return error result", async () => {
        const mcpResponse = {
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32600, message: "Invalid repo" },
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: async () => `data: ${JSON.stringify(mcpResponse)}`,
        }) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          { repoName: "invalid/repo" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error: MCP error: Invalid repo",
        );
      });
    });

    describe("given an invalid SSE response", () => {
      it("then it should return error result", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: async () => "no data prefix here",
        }) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          { repoName: "facebook/react" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error: Invalid MCP response format",
        );
      });
    });
  });

  describe("deepwiki-read-contents", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "deepwiki-read-contents",
      )![0] as MockTool;
    });

    describe("given a successful MCP response", () => {
      it("then it should return wiki contents", async () => {
        const mcpResponse = {
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [
              {
                type: "text",
                text: "# React Documentation\n\nReact is a library for building UIs.",
              },
            ],
          },
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: async () => `data: ${JSON.stringify(mcpResponse)}`,
        }) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          { repoName: "facebook/react" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "# React Documentation\n\nReact is a library for building UIs.",
        );
        expect(result.details.repoName).toBe("facebook/react");
      });
    });
  });

  describe("deepwiki-ask", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "deepwiki-ask",
      )![0] as MockTool;
    });

    describe("given a successful question response", () => {
      it("then it should return the answer", async () => {
        const mcpResponse = {
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [
              {
                type: "text",
                text: "React uses a virtual DOM for efficient rendering.",
              },
            ],
          },
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: async () => `data: ${JSON.stringify(mcpResponse)}`,
        }) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          {
            repoName: "facebook/react",
            question: "How does React render?",
          },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "React uses a virtual DOM for efficient rendering.",
        );
        expect(result.details.repoName).toBe("facebook/react");
        expect(result.details.question).toBe("How does React render?");
      });
    });

    describe("given a network error", () => {
      it("then it should return error result", async () => {
        globalThis.fetch = vi
          .fn()
          .mockRejectedValue(
            new Error("Network error"),
          ) as unknown as typeof globalThis.fetch;

        const result = await tool.execute(
          "tool1",
          {
            repoName: "facebook/react",
            question: "How does React render?",
          },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error: Network error",
        );
        expect(result.details.repoName).toBe("facebook/react");
        expect(result.details.question).toBe("How does React render?");
      });
    });
  });
});
