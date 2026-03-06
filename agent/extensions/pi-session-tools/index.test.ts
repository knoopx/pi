import { describe, it, expect, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";
import setupPiSessionToolsExtension from "./index";
import { decodeSessionPath } from "./index";

describe("Pi Session Tools Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupPiSessionToolsExtension(mockPi as unknown as ExtensionAPI);
  });

  describe("given the extension is initialized", () => {
    it("then it should register all session tools", () => {
      const toolNames = mockPi.registerTool.mock.calls.map(
        (call) => (call[0] as MockTool).name,
      );
      expect(toolNames).toEqual([
        "pi-list-projects",
        "pi-list-sessions",
        "pi-session-events",
        "pi-tool-calls",
        "pi-read-session",
      ]);
    });
  });

  describe("decodeSessionPath", () => {
    describe("given an encoded directory name", () => {
      it("then it should decode to absolute path", () => {
        expect(decodeSessionPath("--home-user-project--")).toBe(
          "/home/user/project",
        );
      });
    });

    describe("given a simple path", () => {
      it("then it should decode correctly", () => {
        expect(decodeSessionPath("--tmp-test--")).toBe("/tmp/test");
      });
    });

    describe("given a deeply nested path", () => {
      it("then it should decode all segments", () => {
        expect(decodeSessionPath("--home-knoopx-.pi-agent-extensions--")).toBe(
          "/home/knoopx/.pi/agent/extensions",
        );
      });
    });
  });

  describe("pi-list-projects", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "pi-list-projects",
      )![0] as MockTool;
    });

    describe("given the sessions directory exists", () => {
      it("then it should return a result with content", async () => {
        const result = await tool.execute(
          "tool1",
          {},
          undefined,
          undefined,
          {},
        );

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe("text");
      });
    });
  });
});
