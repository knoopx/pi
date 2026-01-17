import { spawn, execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import prettier from "prettier";

const StartBrowserParams = Type.Object({
  profile: Type.Optional(
    Type.Boolean({
      description: "Use user profile directory",
    }),
  ),
});

const NavigateBrowserParams = Type.Object({
  url: Type.String({ description: "URL to navigate to" }),
  newTab: Type.Optional(
    Type.Boolean({
      description: "Open in a new tab",
    }),
  ),
});

const EvaluateJavascriptParams = Type.Object({
  code: Type.String({ description: "JavaScript code to evaluate" }),
});

const TakeScreenshotParams = Type.Object({});

const ListTabsParams = Type.Object({});

const CloseTabParams = Type.Object({
  index: Type.Optional(
    Type.Number({ description: "Tab index to close (0-based)" }),
  ),
  title: Type.Optional(
    Type.String({ description: "Close tab with this title (partial match)" }),
  ),
});

const SwitchTabParams = Type.Object({
  index: Type.Number({ description: "Tab index to switch to (0-based)" }),
});

const RefreshTabParams = Type.Object({});

const CurrentUrlParams = Type.Object({});

const PageTitleParams = Type.Object({});

const WaitForElementParams = Type.Object({
  selector: Type.String({ description: "CSS selector to wait for" }),
  timeout: Type.Optional(
    Type.Number({ description: "Timeout in milliseconds (default 10000)" }),
  ),
});

const ClickElementParams = Type.Object({
  selector: Type.String({ description: "CSS selector to click" }),
  all: Type.Optional(
    Type.Boolean({ description: "Click all matching elements" }),
  ),
});

const TypeTextParams = Type.Object({
  selector: Type.Optional(
    Type.String({ description: "CSS selector to focus (optional)" }),
  ),
  text: Type.String({ description: "Text to type" }),
  clear: Type.Optional(
    Type.Boolean({ description: "Clear field before typing" }),
  ),
});

const ExtractTextParams = Type.Object({
  selector: Type.String({ description: "CSS selector to extract text from" }),
  all: Type.Optional(
    Type.Boolean({ description: "Extract from all matching elements" }),
  ),
});

const QueryHtmlElementsParams = Type.Object({
  selector: Type.String({ description: "CSS selector to query" }),
  all: Type.Optional(
    Type.Boolean({ description: "Extract all matching elements" }),
  ),
});

function textResult(
  details: Record<string, unknown>,
  text: string,
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, details };
}

async function withBrowserPage<T>(
  fn: (page: puppeteer.Page, browser: puppeteer.Browser) => Promise<T>,
): Promise<{ result: T } | { error: string }> {
  try {
    const b = await puppeteer.connect({
      browserURL: "http://localhost:9222",
      defaultViewport: null,
    });

    const p = (await b.pages()).at(-1);

    if (!p) {
      await b.disconnect();
      return { error: "✗ No active tab found" };
    }

    const result = await fn(p, b);

    await b.disconnect();

    return { result };
  } catch (error) {
    return { error: `✗ Error: ${(error as Error).message}` };
  }
}

async function getBrowserAndPage(): Promise<
  { b: puppeteer.Browser; p: puppeteer.Page } | { error: string }
> {
  try {
    const b = await puppeteer.connect({
      browserURL: "http://localhost:9222",
      defaultViewport: null,
    });

    const p = (await b.pages()).at(-1);

    if (!p) {
      await b.disconnect();
      return { error: "✗ No active tab found" };
    }

    return { b, p };
  } catch (error) {
    return { error: `✗ Error: ${(error as Error).message}` };
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "start-browser",
    label: "Start Browser",
    description: `Launch a headless browser instance for web automation.

Use this to:
- Begin web scraping or automation sessions
- Test web applications programmatically
- Capture screenshots and interact with dynamic content

The browser runs in the background and connects via debugging protocol.`,
    parameters: StartBrowserParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { profile = false } = params;
      return await startBrowser(profile);
    },
  });

  pi.registerTool({
    name: "navigate-browser",
    label: "Navigate Browser",
    description: `Navigate to a specific URL in the active browser tab.

Use this to:
- Visit web pages for data extraction
- Load specific pages for testing or scraping
- Open new tabs for parallel processing

Supports both existing tabs and creating new ones.`,
    parameters: NavigateBrowserParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { url, newTab = false } = params;
      return await navigateBrowser(url, newTab);
    },
  });

  pi.registerTool({
    name: "evaluate-javascript",
    label: "Evaluate JavaScript",
    description: `Execute JavaScript code in the context of the current web page.

Use this to:
- Extract data from complex page structures
- Interact with JavaScript-heavy websites
- Test and debug web page functionality
- Access browser APIs and page content

Returns the result of the executed code.`,
    parameters: EvaluateJavascriptParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { code } = params;
      return await evalBrowser(code);
    },
  });

  pi.registerTool({
    name: "take-screenshot",
    label: "Take Screenshot",
    description: `Capture a screenshot of the current browser page.

Use this to:
- Document web page states during automation
- Verify visual changes or layouts
- Debug rendering issues
- Archive important web content

Saves the image to a temporary file and returns the path.`,
    parameters: TakeScreenshotParams,

    async execute(_toolCallId, _params, _onUpdate, _ctx, _signal) {
      return await screenshotBrowser();
    },
  });

  pi.registerTool({
    name: "query-html-elements",
    label: "Query HTML Elements",
    description: `Extract HTML elements from the current page using CSS selectors.

Use this to:
- Inspect page structure and element details
- Extract specific HTML components for analysis
- Debug web scraping selectors
- Understand page layout and styling

Returns formatted HTML of matching elements.`,
    parameters: QueryHtmlElementsParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { selector, all = false } = params;
      return await querySelectorBrowser(selector, all);
    },
  });

  pi.registerTool({
    name: "list-tabs",
    label: "List Tabs",
    description: `Get information about all open browser tabs.

Use this to:
- See current browsing session state
- Identify which tabs are active
- Manage multiple tab automation workflows
- Debug tab switching operations

Shows tab index, title, URL, and active status.`,
    parameters: ListTabsParams,

    async execute(_toolCallId, _params, _onUpdate, _ctx, _signal) {
      return await listTabsBrowser();
    },
  });

  pi.registerTool({
    name: "close-tab",
    label: "Close Tab",
    description: `Close a specific browser tab by index or title.

Use this to:
- Clean up completed automation sessions
- Manage browser resource usage
- Reset tab state for fresh operations
- Handle multiple concurrent tasks

Cannot close the last remaining tab.`,
    parameters: CloseTabParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { index, title } = params;
      return await closeTabBrowser(index, title);
    },
  });

  pi.registerTool({
    name: "switch-tab",
    label: "Switch Tab",
    description: `Switch focus to a different browser tab by index.

Use this to:
- Navigate between multiple automation contexts
- Continue work in specific tabs
- Manage parallel scraping operations
- Access different web applications

Makes the specified tab active for subsequent operations.`,
    parameters: SwitchTabParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { index } = params;
      return await switchTabBrowser(index);
    },
  });

  pi.registerTool({
    name: "refresh-tab",
    label: "Refresh Tab",
    description: `Reload the current browser tab.

Use this to:
- Update dynamic web content
- Reset page state during testing
- Handle stale data in automation
- Refresh after form submissions or state changes

Waits for the page to fully load before returning.`,
    parameters: RefreshTabParams,

    async execute(_toolCallId, _params, _onUpdate, _ctx, _signal) {
      return await refreshTabBrowser();
    },
  });

  pi.registerTool({
    name: "current-url",
    label: "Current URL",
    description: `Get the URL of the currently active browser tab.

Use this to:
- Verify navigation results
- Track current page location
- Log browsing session progress
- Validate redirects and page changes

Returns the full URL including query parameters.`,
    parameters: CurrentUrlParams,

    async execute(_toolCallId, _params, _onUpdate, _ctx, _signal) {
      return await getCurrentUrlBrowser();
    },
  });

  pi.registerTool({
    name: "page-title",
    label: "Page Title",
    description: `Get the title of the currently active browser tab.

Use this to:
- Identify current page content
- Verify page load completion
- Log browsing activity
- Check for expected page titles

Returns the text from the browser's title bar.`,
    parameters: PageTitleParams,

    async execute(_toolCallId, _params, _onUpdate, _ctx, _signal) {
      return await getPageTitleBrowser();
    },
  });

  pi.registerTool({
    name: "wait-for-element",
    label: "Wait for Element",
    description: `Wait for a CSS selector to appear on the page.

Use this to:
- Synchronize with dynamic page loading
- Ensure elements are ready before interaction
- Handle AJAX-loaded content
- Test page rendering performance

Blocks until the element exists or timeout occurs.`,
    parameters: WaitForElementParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { selector, timeout = 10000 } = params;
      return await waitForElementBrowser(selector, timeout);
    },
  });

  pi.registerTool({
    name: "click-element",
    label: "Click Element",
    description: `Click on HTML elements matching a CSS selector.

Use this to:
- Interact with buttons, links, and form controls
- Navigate through web applications
- Trigger JavaScript events and actions
- Submit forms or activate dropdowns

Can click single elements or all matching elements.`,
    parameters: ClickElementParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { selector, all = false } = params;
      return await clickElementBrowser(selector, all);
    },
  });

  pi.registerTool({
    name: "type-text",
    label: "Type Text",
    description: `Type text into input fields or focused elements.

Use this to:
- Fill out web forms automatically
- Enter search queries or data
- Simulate user keyboard input
- Test input validation and handling

Optionally clears existing content before typing.`,
    parameters: TypeTextParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { selector, text, clear = false } = params;
      return await typeTextBrowser(selector, text, clear);
    },
  });

  pi.registerTool({
    name: "extract-text",
    label: "Extract Text",
    description: `Extract text content from HTML elements by CSS selector.

Use this to:
- Scrape text data from web pages
- Extract article content or product information
- Gather data for analysis or processing
- Monitor dynamic text changes

Returns plain text from matching elements.`,
    parameters: ExtractTextParams,

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { selector, all = false } = params;
      return await extractTextBrowser(selector, all);
    },
  });

  async function startBrowser(profile: boolean) {
    // Kill existing Cromite
    try {
      execSync("killall cromite", { stdio: "ignore" });
    } catch {}

    // Wait a bit for processes to fully die
    await new Promise((r) => setTimeout(r, 1000));

    // Setup profile directory
    execSync("mkdir -p ~/.cache/scraping", { stdio: "ignore" });

    // Start Cromite in background (detached so Node can exit)
    spawn(
      "cromite",
      [
        "--remote-debugging-port=9222",
        `--user-data-dir=${process.env["HOME"]}/.cache/scraping`,
      ],
      { detached: true, stdio: "ignore" },
    ).unref();

    // Wait for Cromite to be ready by attempting to connect
    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        const browser = await puppeteer.connect({
          browserURL: "http://localhost:9222",
          defaultViewport: null,
        });
        await browser.disconnect();
        connected = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!connected) {
      return textResult({ error: true }, "✗ Failed to connect to Cromite");
    }

    const msg = `✓ Cromite started on :9222${
      profile ? " with your profile" : ""
    }`;
    return textResult({ profile, port: 9222 }, msg);
  }

  async function navigateBrowser(url: string, newTab: boolean) {
    if (newTab) {
      try {
        const b = await puppeteer.connect({
          browserURL: "http://localhost:9222",
          defaultViewport: null,
        });
        const p = await b.newPage();
        await p.goto(url, { waitUntil: "domcontentloaded" });
        await b.disconnect();
        return textResult({ url, newTab: true }, `✓ Opened: ${url}`);
      } catch (error) {
        return textResult(
          { error: true },
          `✗ Error: ${(error as Error).message}`,
        );
      }
    } else {
      const res = await withBrowserPage(async (p) => {
        await p.goto(url, { waitUntil: "domcontentloaded" });
        return `✓ Navigated to: ${url}`;
      });
      if ("error" in res) return textResult({ error: true }, res.error);
      return textResult({ url, newTab: false }, res.result);
    }
  }

  async function evalBrowser(code: string) {
    const res = await withBrowserPage(async (p) => {
      const result = await p.evaluate((c) => {
        const AsyncFunction = (async () => {}).constructor as any;
        return new AsyncFunction(`return (${c})`)();
      }, code);
      return result;
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    const result = res.result;

    if (Array.isArray(result)) {
      let output = "";
      for (let i = 0; i < result.length; i++) {
        if (i > 0) output += "\n";
        for (const [key, value] of Object.entries(result[i])) {
          output += `${key}: ${value}`;
        }
      }
      return textResult({ type: "array", length: result.length }, output);
    } else if (typeof result === "object" && result !== null) {
      let output = "";
      for (const [key, value] of Object.entries(result)) {
        output += `${key}: ${value}\n`;
      }
      return textResult({ type: "object" }, output.trim());
    } else {
      return textResult({ type: typeof result }, String(result));
    }
  }

  async function screenshotBrowser() {
    const res = await withBrowserPage(async (p) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `screenshot-${timestamp}.png`;
      const filepath = join(tmpdir(), filename);

      await p.screenshot({ path: filepath });

      return filepath;
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    return textResult({ filepath: res.result }, res.result);
  }

  async function extractTextBrowser(selector: string, all: boolean) {
    const res = await withBrowserPage(async (p) => {
      const result = await p.evaluate(
        (sel, allFlag) => {
          const elements = allFlag
            ? document.querySelectorAll(sel)
            : document.querySelector(sel)
              ? [document.querySelector(sel)]
              : [];
          return Array.from(elements)
            .map((e) => (e as any).textContent || "")
            .filter((text) => text.trim());
        },
        selector,
        all,
      );
      return result;
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    const result = res.result;

    if (result.length === 0) {
      return textResult({}, "No text found matching the selector.");
    }

    const text = result.join("\n\n");
    return textResult({ selector, all }, text);
  }

  async function typeTextBrowser(
    selector: string | undefined,
    text: string,
    clear: boolean,
  ) {
    const bp = await getBrowserAndPage();
    if ("error" in bp) return textResult({ error: true }, bp.error);
    const { b, p } = bp;

    try {
      if (selector) {
        await p.waitForSelector(selector, { timeout: 5000 });
        const element = await p.$(selector);
        if (element) {
          if (clear) {
            // Puppeteer ElementHandle does not provide .clear(); use click+Ctrl+A+Backspace.
            await element.click({ clickCount: 3 });
            await p.keyboard.press("Backspace");
          }
          await element.type(text);
        } else {
          await b.disconnect();
          return textResult({}, `✗ Element not found: ${selector}`);
        }
      } else {
        // Type into focused element or body
        await p.keyboard.type(text);
      }

      await b.disconnect();
      return textResult({ selector, clear }, `✓ Typed: "${text}"`);
    } catch (error) {
      await b.disconnect();
      return textResult(
        { error: true },
        `✗ Failed to type text: ${(error as Error).message}`,
      );
    }
  }

  async function clickElementBrowser(selector: string, all: boolean) {
    const bp = await getBrowserAndPage();
    if ("error" in bp) return textResult({ error: true }, bp.error);
    const { b, p } = bp;

    try {
      if (all) {
        const elements = await p.$$(selector);
        for (const element of elements) {
          await element.click();
          await new Promise((r) => setTimeout(r, 100)); // Small delay between clicks
        }
        await b.disconnect();
        return textResult({}, `✓ Clicked ${elements.length} elements`);
      } else {
        await p.waitForSelector(selector, { timeout: 5000 });
        await p.click(selector);
        await b.disconnect();
        return textResult({}, `✓ Clicked element: ${selector}`);
      }
    } catch (error) {
      await b.disconnect();
      return textResult(
        { error: true },
        `✗ Failed to click element: ${(error as Error).message}`,
      );
    }
  }

  async function waitForElementBrowser(selector: string, timeout: number) {
    const bp = await getBrowserAndPage();
    if ("error" in bp) return textResult({ error: true }, bp.error);
    const { b, p } = bp;

    try {
      await p.waitForSelector(selector, { timeout });
      await b.disconnect();
      return textResult({}, `✓ Element found: ${selector}`);
    } catch (error) {
      await b.disconnect();
      return textResult(
        { error: true },
        `✗ Element not found within ${timeout}ms: ${selector}`,
      );
    }
  }

  async function getPageTitleBrowser() {
    const res = await withBrowserPage(async (p) => {
      const title = await p.title();
      return title;
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    return textResult({ title: res.result }, res.result);
  }

  async function getCurrentUrlBrowser() {
    const res = await withBrowserPage(async (p) => {
      const url = p.url();
      return url;
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    return textResult({ url: res.result }, res.result);
  }

  async function refreshTabBrowser() {
    const res = await withBrowserPage(async (p) => {
      await p.reload({ waitUntil: "domcontentloaded" });
      return "✓ Page refreshed";
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    return textResult({ refreshed: true }, res.result);
  }

  async function switchTabBrowser(index: number) {
    const res = await withBrowserPage(async (p, b) => {
      const pages = await b.pages();

      if (index < 0 || index >= pages.length) {
        throw new Error(`Invalid tab index: ${index} (0-${pages.length - 1})`);
      }

      const targetPage = pages[index];
      await targetPage.bringToFront();

      return `✓ Switched to tab ${index}`;
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    return textResult({ index }, res.result);
  }

  async function closeTabBrowser(index?: number, title?: string) {
    const res = await withBrowserPage(async (p, b) => {
      const pages = await b.pages();

      if (pages.length <= 1) {
        throw new Error("Cannot close the last remaining tab");
      }

      let targetPage: any = null;
      let targetIndex = -1;

      if (index !== undefined) {
        if (index < 0 || index >= pages.length) {
          throw new Error(
            `Invalid tab index: ${index} (0-${pages.length - 1})`,
          );
        }
        targetPage = pages[index];
        targetIndex = index;
      } else if (title) {
        for (let i = 0; i < pages.length; i++) {
          const pageTitle = await pages[i].title();
          if (pageTitle.toLowerCase().includes(title.toLowerCase())) {
            targetPage = pages[i];
            targetIndex = i;
            break;
          }
        }
        if (!targetPage) {
          throw new Error(`No tab found with title containing: "${title}"`);
        }
      } else {
        // Close the current active tab (last in the array)
        targetPage = pages[pages.length - 1];
        targetIndex = pages.length - 1;
      }

      await targetPage.close();

      return { targetIndex, msg: `✓ Closed tab ${targetIndex}` };
    });

    if ("error" in res) return textResult({ error: true }, `✗ ${res.error}`);

    return textResult({ index: res.result.targetIndex }, res.result.msg);
  }

  async function listTabsBrowser() {
    const res = await withBrowserPage(async (p, b) => {
      const pages = await b.pages();
      const tabs: string[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const title = await page.title();
        const url = page.url();
        const isActive = i === pages.length - 1; // Assuming last page is active
        tabs.push(`${i}: ${isActive ? "[ACTIVE] " : ""}${title} - ${url}`);
      }

      return tabs;
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    const tabs = res.result;

    if (tabs.length === 0) {
      return textResult({}, "No tabs open");
    }

    return textResult({ tabs }, tabs.join("\n"));
  }

  async function querySelectorBrowser(selector: string, all: boolean) {
    const res = await withBrowserPage(async (p) => {
      const result = await p.evaluate(
        (sel, allFlag) => {
          const elements = allFlag
            ? document.querySelectorAll(sel)
            : document.querySelector(sel)
              ? [document.querySelector(sel)]
              : [];
          return Array.from(elements).map((e) => (e as any).outerHTML);
        },
        selector,
        all,
      );
      return result;
    });

    if ("error" in res) return textResult({ error: true }, res.error);

    const result = res.result;

    if (result.length === 0) {
      return textResult({}, "No elements found matching the selector.");
    }

    const html = result.join("\n\n");
    const prettified = await prettier.format(html, { parser: "html" });

    return textResult({ selector, all }, prettified);
  }
}
