import { describe, it, expect, beforeEach } from "vitest";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";
import setupGogExtension from "./index";

describe("Google Services Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupGogExtension(mockPi as unknown as ExtensionAPI);
  });

  describe("given the extension is initialized", () => {
    it("then it should register all google tools", () => {
      const toolNames = mockPi.registerTool.mock.calls.map(
        (call) => (call[0] as MockTool).name,
      );
      expect(toolNames).toEqual([
        "list-google-drive-files",
        "get-google-drive-file",
        "search-google-drive-files",
        "search-google-gmail-messages",
        "get-gmail-message",
        "list-calendar-events",
        "get-google-calendar-event",
        "search-google-calendar-events",
        "list-google-calendars",
        "list-google-contacts",
        "get-google-contact",
        "search-google-contacts",
        "list-google-task-lists",
        "list-google-tasks",
        "add-google-task",
        "update-google-task",
        "complete-google-task",
        "uncomplete-google-task",
        "delete-google-task",
        "clear-google-tasks",
        "get-google-docs-info",
        "export-google-docs",
        "create-google-docs",
        "copy-google-docs",
        "cat-google-docs",
        "list-google-accounts",
      ]);
    });
  });

  describe("list-google-accounts", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "list-google-accounts",
      )![0] as MockTool;
    });

    describe("given authenticated accounts exist", () => {
      it("then it should return formatted account list", async () => {
        mockPi.exec.mockResolvedValue({
          stdout: "user@gmail.com\tdefault\tdrive,gmail,calendar",
          stderr: "",
        });

        const result = await tool.execute(
          "tool1",
          {},
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Authenticated accounts:\nuser@gmail.com (client: default, scopes: drive, gmail, calendar)",
        );
      });
    });

    describe("given no accounts authenticated", () => {
      it("then it should return error message", async () => {
        mockPi.exec.mockRejectedValue(new Error("No accounts found"));

        const result = await tool.execute(
          "tool1",
          {},
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "No authenticated accounts found. Run 'gog auth' to authenticate.",
        );
      });
    });
  });

  describe("search-google-drive-files", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "search-google-drive-files",
      )![0] as MockTool;
    });

    describe("given no accounts are available", () => {
      it("then it should return error", async () => {
        mockPi.exec.mockResolvedValue({ stdout: "", stderr: "" });

        const result = await tool.execute(
          "tool1",
          { query: "test" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error: No authenticated accounts found. Run 'gog auth' first.",
        );
      });
    });
  });

  describe("search-google-gmail-messages", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "search-google-gmail-messages",
      )![0] as MockTool;
    });

    describe("given no accounts are available", () => {
      it("then it should return error", async () => {
        mockPi.exec.mockResolvedValue({ stdout: "", stderr: "" });

        const result = await tool.execute(
          "tool1",
          {},
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error: No authenticated accounts found. Run 'gog auth' first.",
        );
      });
    });
  });
});
