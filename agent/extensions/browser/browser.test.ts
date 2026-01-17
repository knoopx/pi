import { describe, it, expect, beforeEach, vi } from "vitest";

// Mocks must be defined before imports
const mockExecSync = vi.fn();
const mockConnect = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({ pid: 12345, unref: vi.fn() })),
  execSync: mockExecSync,
}));

// Mock process.kill
const mockKill = vi.fn();
Object.defineProperty(global.process, "kill", {
  value: mockKill,
  writable: true,
});

vi.mock("puppeteer-core", () => ({
  default: { connect: mockConnect },
}));

import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import setupBrowserExtension from "./index";

describe("Browser Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      on: vi.fn(),
    };
    setupBrowserExtension(mockPi);
  });

  it("should register all browser tools", () => {
    const expectedTools = [
      "navigate-url",
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

  describe("navigate-url tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "navigate-url",
      )[0];
    });

    it("should have correct label and description", () => {
      expect(registeredTool.label).toBe("Navigate URL");
      expect(registeredTool.description).toBe(
        `Navigate to a specific URL in a new browser tab.

Use this to:
- Visit web pages for data extraction
- Load specific pages for testing or scraping
- Open new tabs for parallel processing

Always opens in a new tab.`,
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
        `Execute JavaScript code in the context of the current web page.

Use this to:
- Extract data from complex page structures
- Interact with JavaScript-heavy websites
- Test and debug web page functionality
- Access browser APIs and page content

Returns the result of the executed code.`,
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
        `Capture a screenshot of the current browser page.

Use this to:
- Document web page states during automation
- Verify visual changes or layouts
- Debug rendering issues
- Archive important web content

Saves the image to a temporary file and returns the path.`,
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
        `Get information about all open browser tabs.

Use this to:
- See current browsing session state
- Identify which tabs are active
- Manage multiple tab automation workflows
- Debug tab switching operations

Shows tab index, title, URL, and active status.`,
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
        `Close a specific browser tab by index or title.

Use this to:
- Clean up completed automation sessions
- Manage browser resource usage
- Reset tab state for fresh operations
- Handle multiple concurrent tasks

Cannot close the last remaining tab.`,
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
        `Switch focus to a different browser tab by index.

Use this to:
- Navigate between multiple automation contexts
- Continue work in specific tabs
- Manage parallel scraping operations
- Access different web applications

Makes the specified tab active for subsequent operations.`,
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
        `Extract HTML elements from the current page using CSS selectors.

Use this to:
- Inspect page structure and element details
- Extract specific HTML components for analysis
- Debug web scraping selectors
- Understand page layout and styling

Returns formatted HTML of matching elements.`,
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
        `Extract text content from HTML elements by CSS selector.

Use this to:
- Scrape text data from web pages
- Extract article content or product information
- Gather data for analysis or processing
- Monitor dynamic text changes

Returns plain text from matching elements.`,
      );
    });
  });
});

describe("E2E Tests", () => {
  let mockPi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPi = {
      registerTool: vi.fn(),
      on: vi.fn(),
    };
    setupBrowserExtension(mockPi);
  });

  describe("navigate-url", () => {
    it("should open URL in new tab", async () => {
      const mockPage = {
        goto: vi.fn(),
        title: vi.fn().mockResolvedValue("New Tab Page"),
        evaluate: vi.fn().mockResolvedValue(["article"]),
      };
      const mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "navigate-url",
      )[0];

      const result = await tool.execute(
        "id",
        { url: "https://example.com" },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", {
        waitUntil: "domcontentloaded",
      });
      expect(result.content[0].text).toContain("Opened: https://example.com");
      expect(result.content[0].text).toContain("Page Title: New Tab Page");
      expect(result.content[0].text).toContain("Suggested selectors: article");
      expect(result.details).toHaveProperty("title", "New Tab Page");
      expect(result.details).toHaveProperty("suggestedSelectors");
    });
  });

  describe("evaluate-javascript", () => {
    it("should evaluate JavaScript and return result", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue("result"),
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "evaluate-javascript",
      )[0];

      const result = await tool.execute(
        "id",
        { code: "1 + 1" },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.content[0].text).toBe("result");
      expect(result.details).toEqual({ type: "string" });
    });

    it("should handle evaluation error", async () => {
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "evaluate-javascript",
      )[0];

      const result = await tool.execute(
        "id",
        { code: "invalid" },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.details.error).toBe(true);
      expect(result.content[0].text).toContain("No active tab found");
    });
  });

  describe("take-screenshot", () => {
    it("should take screenshot and return filepath", async () => {
      const mockPage = {
        screenshot: vi.fn().mockResolvedValue(undefined),
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "take-screenshot",
      )[0];

      const result = await tool.execute(
        "id",
        {},
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining("screenshot-"),
        }),
      );
      expect(result.content[0].text).toContain("screenshot-");
      expect(result.details).toHaveProperty("filepath");
    });
  });

  describe("extract-text", () => {
    it("should extract text from single element", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(["Hello World"]),
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "extract-text",
      )[0];

      const result = await tool.execute(
        "id",
        { selector: "h1", all: false },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.content[0].text).toBe("Hello World");
      expect(result.details).toEqual({ selector: "h1", all: false });
    });

    it("should extract text from all elements", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(["Item 1", "Item 2"]),
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "extract-text",
      )[0];

      const result = await tool.execute(
        "id",
        { selector: ".item", all: true },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.content[0].text).toBe("Item 1\n\nItem 2");
    });
  });

  describe("click-element", () => {
    it("should click single element", async () => {
      const mockElement = { click: vi.fn() };
      const mockPage = {
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        $: vi.fn().mockResolvedValue(mockElement),
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "click-element",
      )[0];

      const result = await tool.execute(
        "id",
        { selector: "button", all: false },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockPage.click).toHaveBeenCalledWith("button");
      expect(result.content[0].text).toContain("Clicked element: button");
    });

    it("should click all elements", async () => {
      const mockElements = [{ click: vi.fn() }, { click: vi.fn() }];
      const mockPage = {
        $$: vi.fn().mockResolvedValue(mockElements),
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "click-element",
      )[0];

      const result = await tool.execute(
        "id",
        { selector: "button", all: true },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockElements[0].click).toHaveBeenCalled();
      expect(mockElements[1].click).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Clicked 2 elements");
    });
  });

  describe("type-text", () => {
    it("should type text into element", async () => {
      const mockElement = {
        click: vi.fn(),
        type: vi.fn(),
      };
      const mockPage = {
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        $: vi.fn().mockResolvedValue(mockElement),
        keyboard: { press: vi.fn() },
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "type-text",
      )[0];

      const result = await tool.execute(
        "id",
        { selector: "input", text: "hello", clear: true },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockElement.click).toHaveBeenCalledWith({ clickCount: 3 });
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Backspace");
      expect(mockElement.type).toHaveBeenCalledWith("hello");
      expect(result.content[0].text).toContain('Typed: "hello"');
    });

    it("should type text without selector", async () => {
      const mockPage = {
        keyboard: { type: vi.fn() },
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "type-text",
      )[0];

      const result = await tool.execute(
        "id",
        { text: "hello" },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockPage.keyboard.type).toHaveBeenCalledWith("hello");
      expect(result.content[0].text).toContain('Typed: "hello"');
    });
  });

  describe("list-tabs", () => {
    it("should list all tabs", async () => {
      const mockPages = [
        {
          title: vi.fn().mockResolvedValue("Tab 1"),
          url: vi.fn().mockReturnValue("https://tab1.com"),
        },
        {
          title: vi.fn().mockResolvedValue("Tab 2"),
          url: vi.fn().mockReturnValue("https://tab2.com"),
        },
      ];
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue(mockPages),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "list-tabs",
      )[0];

      const result = await tool.execute(
        "id",
        {},
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.content[0].text).toContain("0: Tab 1 - https://tab1.com");
      expect(result.content[0].text).toContain(
        "1: [ACTIVE] Tab 2 - https://tab2.com",
      );
    });
  });

  describe("switch-tab", () => {
    it("should switch to specified tab", async () => {
      const mockPages = [{ bringToFront: vi.fn() }, { bringToFront: vi.fn() }];
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue(mockPages),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "switch-tab",
      )[0];

      const result = await tool.execute(
        "id",
        { index: 1 },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockPages[1].bringToFront).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Switched to tab 1");
    });
  });

  describe("close-tab", () => {
    it("should close tab by index", async () => {
      const mockPages = [{ close: vi.fn() }, { close: vi.fn() }];
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue(mockPages),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "close-tab",
      )[0];

      const result = await tool.execute(
        "id",
        { index: 0 },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockPages[0].close).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Closed tab 0");
    });

    it("should close tab by title", async () => {
      const mockPages = [
        { title: vi.fn().mockResolvedValue("Home"), close: vi.fn() },
        { title: vi.fn().mockResolvedValue("About"), close: vi.fn() },
      ];
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue(mockPages),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "close-tab",
      )[0];

      const result = await tool.execute(
        "id",
        { title: "Home" },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockPages[0].close).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Closed tab 0");
    });
  });

  describe("current-url", () => {
    it("should get current URL", async () => {
      const mockPage = { url: vi.fn().mockReturnValue("https://example.com") };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "current-url",
      )[0];

      const result = await tool.execute(
        "id",
        {},
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.content[0].text).toBe("https://example.com");
      expect(result.details).toEqual({ url: "https://example.com" });
    });
  });

  describe("page-title", () => {
    it("should get page title", async () => {
      const mockPage = { title: vi.fn().mockResolvedValue("Example Page") };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "page-title",
      )[0];

      const result = await tool.execute(
        "id",
        {},
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.content[0].text).toBe("Example Page");
      expect(result.details).toEqual({ title: "Example Page" });
    });
  });

  describe("refresh-tab", () => {
    it("should refresh the page", async () => {
      const mockPage = { reload: vi.fn().mockResolvedValue(undefined) };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "refresh-tab",
      )[0];

      const result = await tool.execute(
        "id",
        {},
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockPage.reload).toHaveBeenCalledWith({
        waitUntil: "domcontentloaded",
      });
      expect(result.content[0].text).toContain("Page refreshed");
    });
  });

  describe("wait-for-element", () => {
    it("should wait for element to appear", async () => {
      const mockPage = {
        waitForSelector: vi.fn().mockResolvedValue(undefined),
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "wait-for-element",
      )[0];

      const result = await tool.execute(
        "id",
        { selector: ".loading", timeout: 5000 },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(".loading", {
        timeout: 5000,
      });
      expect(result.content[0].text).toContain("Element found: .loading");
    });
  });

  describe("query-html-elements", () => {
    it("should query HTML elements", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(["<div>Hello</div>"]),
      };
      const mockBrowser = {
        pages: vi.fn().mockResolvedValue([mockPage]),
        disconnect: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockBrowser);

      const tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "query-html-elements",
      )[0];

      const result = await tool.execute(
        "id",
        { selector: "div", all: false },
        vi.fn(),
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.content[0].text).toContain("<div>Hello</div>");
      expect(result.details).toEqual({ selector: "div", all: false });
    });
  });
});
