import { describe, it, expect, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";
import setupRagExtension from "./index";

describe("RAG Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupRagExtension(mockPi as unknown as ExtensionAPI);
  });

  describe("given the extension is initialized", () => {
    it("then it should register rag-search tool", () => {
      const toolNames = mockPi.registerTool.mock.calls.map(
        (call) => (call[0] as MockTool).name,
      );
      expect(toolNames).toEqual(["rag-search"]);
    });
  });

  describe("rag-search", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "rag-search",
      )![0] as MockTool;
    });

    describe("given a query is executed", () => {
      it("then it should return text content", async () => {
        const result = await tool.execute(
          "tool1",
          { query: "test query" },
          undefined,
          undefined,
          { cwd: "/tmp", ui: { notify: () => {} } },
        );

        expect(result.content[0].type).toBe("text");
        expect(typeof (result.content[0] as { text: string }).text).toBe(
          "string",
        );
      });
    });
  });
});
