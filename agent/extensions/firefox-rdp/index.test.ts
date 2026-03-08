import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

interface MockTab {
  actor: string;
  url: string;
}

interface MockState {
  tabs: MockTab[];
  lastRequests: { to: string; type: string; text?: string }[];
  evalResultByIncludes: { includes: string; result: string }[];
  evalExceptionMessage?: string;
}

const mockState: MockState = {
  tabs: [],
  lastRequests: [],
  evalResultByIncludes: [],
};

function encodePacket(message: unknown): Buffer {
  const json = JSON.stringify(message);
  return Buffer.from(`${Buffer.byteLength(json)}:${json}`);
}

class MockSocket extends EventEmitter {
  private respond(message: unknown) {
    queueMicrotask(() => {
      this.emit("data", encodePacket(message));
    });
  }

  write(payload: string | Buffer) {
    const raw = String(payload);
    const sep = raw.indexOf(":");
    const request = JSON.parse(raw.slice(sep + 1)) as {
      to: string;
      type: string;
      text?: string;
    };

    mockState.lastRequests.push(request);

    if (request.to === "root" && request.type === "listTabs") {
      this.respond({ from: "root", tabs: mockState.tabs });
      return;
    }

    if (request.type === "getTarget" && request.to.startsWith("tab-")) {
      this.respond({
        from: request.to,
        frame: { consoleActor: `console-${request.to}` },
      });
      return;
    }

    if (request.type === "getProcess") {
      this.respond({
        from: "root",
        processDescriptor: { actor: "process-descriptor-1" },
      });
      return;
    }

    if (request.type === "getTarget" && request.to === "process-descriptor-1") {
      this.respond({
        from: "process-descriptor-1",
        process: { consoleActor: "chrome-console-1" },
      });
      return;
    }

    if (request.type === "evaluateJSAsync") {
      if (mockState.evalExceptionMessage) {
        this.respond({
          from: request.to,
          type: "evaluationResult",
          hasException: true,
          exceptionMessage: mockState.evalExceptionMessage,
        });
        return;
      }

      const matched = mockState.evalResultByIncludes.find((entry) =>
        request.text?.includes(entry.includes),
      );
      const result = matched?.result ?? "ok";

      this.respond({
        from: request.to,
        type: "evaluationResult",
        hasException: false,
        result,
      });
      return;
    }
  }

  destroy() {
    // no-op
  }
}

vi.mock("node:net", () => {
  return {
    createConnection: vi.fn(() => {
      const socket = new MockSocket();

      queueMicrotask(() => {
        socket.emit("connect");
        setTimeout(() => {
          socket.emit(
            "data",
            encodePacket({ from: "root", applicationType: "browser" }),
          );
        }, 0);
      });

      return socket;
    }),
  };
});

const mockKill = vi.fn();
vi.mock("node:child_process", () => {
  return {
    execSync: vi.fn(),
    spawn: vi.fn(() => ({ kill: mockKill })),
  };
});

vi.mock("node:fs", () => {
  return {
    mkdtempSync: vi.fn(() => "/tmp/firefox-rdp-test-profile"),
    writeFileSync: vi.fn(),
  };
});

interface RegisteredTool {
  name: string;
  execute: (...args: unknown[]) => Promise<{
    content: {
      type: string;
      text?: string;
      data?: string;
      mimeType?: string;
    }[];
    isError?: boolean;
  }>;
}

function createPiMock() {
  const tools = new Map<string, RegisteredTool>();
  return {
    tools,
    pi: {
      on: vi.fn(),
      registerTool: vi.fn((tool: RegisteredTool) => {
        tools.set(tool.name, tool);
      }),
    },
  };
}

describe("firefox-rdp extension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockState.tabs = [];
    mockState.lastRequests = [];
    mockState.evalResultByIncludes = [];
    mockState.evalExceptionMessage = undefined;
  });

  describe("given extension is initialized", () => {
    describe("when registering tools", () => {
      it("then exposes the expected public API tools", async () => {
        const mod = await import("./index");
        const { pi, tools } = createPiMock();

        mod.default(pi as never);

        expect(Array.from(tools.keys())).toEqual([
          "launch-browser",
          "list-browser-tabs",
          "eval-js-in-tab",
          "query-dom",
          "navigate-tab",
          "reload-tab",
          "close-tab",
          "screenshot-tab",
          "screenshot-element",
          "close-browser",
        ]);
      });
    });
  });

  describe("given browser lifecycle operations", () => {
    describe("when launching and closing browser", () => {
      it("then returns success messages for critical user journey", async () => {
        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const launch = tools.get("launch-browser");
        const close = tools.get("close-browser");

        const launchResult = await launch!.execute("id", {
          url: "https://example.com",
        });
        const closeResult = await close!.execute("id", {});

        expect(launchResult.content).toEqual([
          { type: "text", text: "Launched Firefox • port 9222" },
        ]);
        expect(closeResult.content).toEqual([
          { type: "text", text: "Closed Firefox" },
        ]);
      });
    });

    describe("when closing browser without launch", () => {
      it("then reports browser is not running", async () => {
        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const close = tools.get("close-browser");
        const result = await close!.execute("id", {});

        expect(result.content).toEqual([
          { type: "text", text: "Error • Firefox is not running" },
        ]);
      });
    });
  });

  describe("given tab management", () => {
    describe("when listing open tabs", () => {
      it("then returns indexed tab URLs", async () => {
        mockState.tabs = [
          { actor: "tab-1", url: "https://example.com" },
          { actor: "tab-2", url: "https://mozilla.org" },
        ];

        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const listTabs = tools.get("list-browser-tabs");
        const result = await listTabs!.execute("id", {});

        expect(result.isError).toBeUndefined();
        expect(result.content[0]?.text).toMatchSnapshot();
      });
    });

    describe("when navigating and reloading a tab", () => {
      it("then issues tab evaluation commands and reports success", async () => {
        mockState.tabs = [{ actor: "tab-1", url: "https://example.com" }];

        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const navigate = tools.get("navigate-tab");
        const reload = tools.get("reload-tab");

        const navigateResult = await navigate!.execute("id", {
          tab: 0,
          url: "https://example.org/path",
        });
        const reloadResult = await reload!.execute("id", { tab: 0 });

        expect(navigateResult.isError).toBeUndefined();
        expect(navigateResult.content).toEqual([
          { type: "text", text: "Navigated tab • https://example.org/path" },
        ]);
        expect(reloadResult.isError).toBeUndefined();
        expect(reloadResult.content).toEqual([
          { type: "text", text: "Reloaded tab • https://example.com" },
        ]);

        const evalRequests = mockState.lastRequests.filter(
          (request) => request.type === "evaluateJSAsync",
        );
        expect(
          evalRequests.some((request) =>
            request.text?.includes("window.location.href"),
          ),
        ).toBe(true);
        expect(
          evalRequests.some((request) =>
            request.text?.includes("location.reload()"),
          ),
        ).toBe(true);
      });
    });

    describe("when closing a tab", () => {
      it("then reports closed tab URL", async () => {
        mockState.tabs = [{ actor: "tab-1", url: "https://close.me" }];

        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const closeTab = tools.get("close-tab");
        const result = await closeTab!.execute("id", { tab: 0 });

        expect(result.content).toEqual([
          { type: "text", text: "Closed tab • https://close.me" },
        ]);
      });
    });
  });

  describe("given JS evaluation APIs", () => {
    describe("when evaluating JS in tab with valid tab", () => {
      it("then returns evaluation output", async () => {
        mockState.tabs = [{ actor: "tab-1", url: "https://eval.test" }];
        mockState.evalResultByIncludes = [{ includes: "2 + 2", result: "4" }];

        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const evalJs = tools.get("eval-js-in-tab");
        const result = await evalJs!.execute("id", {
          expression: "2 + 2",
          tab: 0,
        });

        expect(result.isError).toBeUndefined();
        expect(result.content).toEqual([{ type: "text", text: "4" }]);
      });
    });

    describe("when evaluating JS in tab with missing tab", () => {
      it("then returns an error response", async () => {
        mockState.tabs = [];

        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const evalJs = tools.get("eval-js-in-tab");
        const result = await evalJs!.execute("id", {
          expression: "1 + 1",
          tab: 0,
        });

        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
          { type: "text", text: "Error • No tab at that index" },
        ]);
      });
    });

    describe("when page evaluation throws", () => {
      it("then propagates safe error text", async () => {
        mockState.tabs = [{ actor: "tab-1", url: "https://boom.test" }];
        mockState.evalExceptionMessage = "boom";

        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const evalJs = tools.get("eval-js-in-tab");
        const result = await evalJs!.execute("id", {
          expression: "throw new Error()",
          tab: 0,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain("Error: boom");
      });
    });
  });

  describe("given query-dom business behavior", () => {
    describe("when selector matches elements", () => {
      it("then returns devtools-like prettified HTML blocks", async () => {
        mockState.tabs = [{ actor: "tab-1", url: "https://dom.test" }];
        mockState.evalResultByIncludes = [
          {
            includes: "JSON.stringify({ total: els.length, shown, html })",
            result: JSON.stringify({
              total: 2,
              shown: 2,
              html: [
                '<div class="card">\n  <span>hello</span>\n</div>',
                '<a href="/x">x</a>',
              ],
            }),
          },
        ];

        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const query = tools.get("query-dom");
        const result = await query!.execute("id", {
          selector: ".card",
          tab: 0,
          limit: 5,
        });

        expect(result.content[0]?.text).toMatchSnapshot();
      });
    });
  });

  describe("given screenshot APIs", () => {
    describe("when screenshotting viewport", () => {
      it("then returns an image attachment", async () => {
        mockState.tabs = [{ actor: "tab-1", url: "https://screen.test" }];
        mockState.evalResultByIncludes = [
          {
            includes:
              "JSON.stringify({ x: window.scrollX, y: window.scrollY, w: document.documentElement.clientWidth, h: document.documentElement.clientHeight })",
            result: JSON.stringify({ x: 0, y: 0, w: 100, h: 80 }),
          },
          {
            includes: "drawSnapshot",
            result: "data:image/png;base64,ZmFrZS1wbmc=",
          },
        ];

        const mod = await import("./index");
        const { pi, tools } = createPiMock();
        mod.default(pi as never);

        const screenshot = tools.get("screenshot-tab");
        const result = await screenshot!.execute("id", { tab: 0 });

        expect(result.isError).toBeUndefined();
        expect(result.content[0]).toEqual({
          type: "text",
          text: "Captured screenshot • png attachment",
        });
        expect(result.content[1]).toEqual({
          type: "image",
          mimeType: "image/png",
          data: "ZmFrZS1wbmc=",
        });
      });
    });
  });
});
