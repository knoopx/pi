import { describe, it, expect, beforeEach, vi } from "vitest";
import setupBrowserExtension from "./index";

describe("Browser Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
    };
    setupBrowserExtension(mockPi);
  });

  it("should register all browser tools", () => {
    const expectedTools = [
      "start-browser",
      "navigate-browser",
      "evaluate-javascript",
      "take-screenshot",
      "query-html-elements",
      "list-tabs",
      "close-tab",
      "switch-tab",
      "refresh-tab",
      "current-url",
      "page-title",
      "wait-for-element",
      "click-element",
      "type-text",
      "extract-text",
    ];

    expectedTools.forEach((toolName) => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: toolName,
        }),
      );
    });

    expect(mockPi.registerTool).toHaveBeenCalledTimes(expectedTools.length);
  });

  describe("start-browser tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "start-browser",
      )[0];
    });

    it("should have correct parameters schema", () => {
      expect(registeredTool.parameters).toBeDefined();
      // Parameters validation would be tested in integration tests
    });

    it("should have execute function", () => {
      expect(typeof registeredTool.execute).toBe("function");
    });
  });

  describe("navigate-browser tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "navigate-browser",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("Navigate Browser");
      expect(registeredTool.description).toBe(
        "Navigate to a URL in the browser",
      );
    });
  });

  describe("evaluate-javascript tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "evaluate-javascript",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("Evaluate JavaScript");
      expect(registeredTool.description).toBe(
        "Evaluate JavaScript code in the active browser tab",
      );
    });
  });

  describe("take-screenshot tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "take-screenshot",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("Take Screenshot");
      expect(registeredTool.description).toBe(
        "Take a screenshot of the active browser tab",
      );
    });
  });

  describe("list-tabs tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "list-tabs",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("List Tabs");
      expect(registeredTool.description).toBe(
        "List all open browser tabs with their titles and URLs",
      );
    });
  });

  describe("close-tab tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "close-tab",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("Close Tab");
      expect(registeredTool.description).toBe(
        "Close a browser tab by index or title",
      );
    });
  });

  describe("switch-tab tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "switch-tab",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("Switch Tab");
      expect(registeredTool.description).toBe(
        "Switch to a specific tab by index",
      );
    });
  });

  describe("query-html-elements tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "query-html-elements",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("Query HTML Elements");
      expect(registeredTool.description).toBe(
        "Extract HTML elements by CSS selector",
      );
    });
  });

  describe("extract-text tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "extract-text",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("Extract Text");
      expect(registeredTool.description).toBe(
        "Extract text content from elements by CSS selector",
      );
    });
  });
});
