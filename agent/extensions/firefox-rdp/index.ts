/**
 * Firefox RDP Extension
 *
 * Controls Firefox via its Remote Debugging Protocol.
 * Provides tools for launching Firefox, managing tabs, evaluating JS,
 * querying DOM, taking screenshots, and navigating.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { createConnection, type Socket } from "node:net";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import { sectionDivider, dotJoin, countLabel } from "../renderers/header";
import { table, type Column } from "../renderers/table";
import { actionLine } from "../renderers/action";

const MAX_LINES = 5000;
const DEBUG_PORT = 9222;
const FIREFOX_BIN = "firefox-esr";

function truncateLines(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= MAX_LINES) return text;
  return (
    lines.slice(0, MAX_LINES).join("\n") +
    `\n... truncated (${lines.length - MAX_LINES} more lines)`
  );
}

// --- Minimal Firefox Remote Debugging Protocol client ---

class RDPClient extends EventEmitter {
  private socket: Socket | null = null;
  private incoming = Buffer.alloc(0);
  private pending: {
    to: string;
    message: unknown;
    resolve: (v: unknown) => void;
  }[] = [];
  private active = new Map<string, (v: unknown) => void>();

  connect(port: number, host = "127.0.0.1"): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = createConnection({ host, port });
      this.socket.on("connect", () => {
        resolve();
      });
      this.socket.on("error", (error) => {
        reject(error);
      });
      this.socket.on("data", (data) => {
        this.incoming = Buffer.concat([this.incoming, data as Buffer]);
        while (this.readMessage()) {}
      });
    });
  }

  disconnect() {
    this.socket?.destroy();
    this.socket = null;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private readMessage(): boolean {
    const str = this.incoming.toString();
    const sep = str.indexOf(":");
    if (sep < 0) return false;
    const len = parseInt(str.slice(0, sep), 10);
    if (this.incoming.length - (sep + 1) < len) return false;
    this.incoming = this.incoming.subarray(sep + 1);
    const packet = this.incoming.subarray(0, len);
    this.incoming = this.incoming.subarray(len);
    try {
      const msg = JSON.parse(packet.toString());
      this.handleMessage(msg);
    } catch {}
    return true;
  }

  private handleMessage(msg: any) {
    const from = typeof msg.from === "string" ? msg.from : undefined;
    if (from) {
      const cb = this.active.get(from);
      if (cb) {
        this.active.delete(from);
        cb(msg);
        this.flush();
      }
    }
    this.emit("message", msg);
  }

  request(message: any): Promise<any> {
    return new Promise((resolve) => {
      this.pending.push({ to: message.to, message, resolve });
      this.flush();
    });
  }

  private flush() {
    this.pending = this.pending.filter((req) => {
      if (this.active.has(req.to)) return true;
      this.send(req.message);
      this.active.set(req.to, req.resolve);
      return false;
    });
  }

  private send(msg: any) {
    const str = JSON.stringify(msg);
    const payload = `${Buffer.byteLength(str)}:${str}`;
    this.socket?.write(payload);
  }

  sendRaw(msg: any) {
    this.send(msg);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// --- Browser state ---

interface BrowserTab {
  actor: string;
  url: string;
}

let client: RDPClient | null = null;
let firefoxProcess: ChildProcess | null = null;
let chromeConsoleActor: string | null = null;
const tabActorCache = new Map<string, { consoleActor: string }>();

function cleanup() {
  client?.disconnect();
  client = null;
  tabActorCache.clear();
  chromeConsoleActor = null;
  if (firefoxProcess) {
    try {
      firefoxProcess.kill("SIGKILL");
    } catch {}
    firefoxProcess = null;
  }
}

async function killExisting(): Promise<void> {
  try {
    execSync("pkill -9 -f 'firefox.*start-debugger'", { stdio: "ignore" });
  } catch {}
  await new Promise((r) => setTimeout(r, 1500));
}

async function waitForPort(
  port: number,
  host = "127.0.0.1",
  timeout = 5000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const s = createConnection({ host, port });
        s.on("connect", () => {
          s.destroy();
          resolve();
        });
        s.on("error", reject);
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`Timeout waiting for port ${port}`);
}

async function connectToFirefox(): Promise<void> {
  client?.disconnect();
  client = null;
  tabActorCache.clear();
  chromeConsoleActor = null;

  client = new RDPClient();
  client.setMaxListeners(0);
  await client.connect(DEBUG_PORT);

  await new Promise<void>((resolve) => {
    const handler = (msg: { from?: string }) => {
      if (msg.from === "root") {
        client!.removeListener("message", handler);
        resolve();
      }
    };
    client!.on("message", handler);
  });
}

async function launchFirefox(url: string): Promise<void> {
  await killExisting();

  const profileDir = mkdtempSync(join(tmpdir(), "firefox_profile-"));
  const prefs = [
    "user_pref('devtools.chrome.enabled', true);",
    "user_pref('devtools.debugger.prompt-connection', false);",
    "user_pref('devtools.debugger.remote-enabled', true);",
    "user_pref('toolkit.telemetry.reportingpolicy.firstRun', false);",
    "user_pref('datareporting.policy.dataSubmissionEnabled', false);",
    "user_pref('browser.shell.checkDefaultBrowser', false);",
    "user_pref('browser.startup.homepage_override.mstone', 'ignore');",
    "user_pref('browser.tabs.warnOnClose', false);",
  ].join("\n");
  writeFileSync(join(profileDir, "prefs.js"), prefs);

  firefoxProcess = spawn(
    FIREFOX_BIN,
    [
      "-profile",
      profileDir,
      "-start-debugger-server",
      String(DEBUG_PORT),
      "-url",
      url,
    ],
    { stdio: "ignore" },
  );

  await waitForPort(DEBUG_PORT);
  await connectToFirefox();
}

async function getChromeConsoleActor(): Promise<string> {
  if (chromeConsoleActor) return chromeConsoleActor;
  if (!client) throw new Error("Not connected");
  const processResp = await client.request({
    to: "root",
    type: "getProcess",
    id: 0,
  });
  const pdActor = processResp.processDescriptor?.actor;
  if (!pdActor) throw new Error("No process descriptor");
  const pdTarget = await client.request({ to: pdActor, type: "getTarget" });
  chromeConsoleActor = pdTarget.process?.consoleActor as string;
  if (!chromeConsoleActor) throw new Error("No chrome console actor");
  return chromeConsoleActor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveGrip(result: any): Promise<string> {
  if (typeof result === "string") return result;
  if (result === null) return "null";
  if (result === undefined) return "undefined";
  if (typeof result === "number" || typeof result === "boolean")
    return String(result);
  if (result?.type === "undefined") return "undefined";
  if (result?.type === "longString" && result.actor && client) {
    const resp = await client.request({
      to: result.actor,
      type: "substring",
      start: 0,
      end: result.length,
    });
    return resp.substring || "";
  }
  if (result?.type === "longString") return result.initial || "";
  return JSON.stringify(result, null, 2);
}

async function evalInChrome(expression: string): Promise<string> {
  if (!client) throw new Error("Not connected");
  const actor = await getChromeConsoleActor();

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client!.removeListener("message", handler);
      reject(new Error("chrome eval timeout"));
    }, 5000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (msg: any) => {
      if (msg.from === actor && msg.type === "evaluationResult") {
        client!.removeListener("message", handler);
        clearTimeout(timeout);
        if (msg.hasException) {
          reject(new Error(msg.exceptionMessage || "chrome evaluation error"));
        } else {
          resolveGrip(msg.result).then(resolve, reject);
        }
      }
    };
    client!.on("message", handler);
    client!.sendRaw({
      to: actor,
      type: "evaluateJSAsync",
      text: expression,
      mapped: { await: true },
    });
  });
}

async function getTabActors(
  tab: BrowserTab,
): Promise<{ consoleActor: string }> {
  if (!client) throw new Error("Not connected");
  const cached = tabActorCache.get(tab.actor);
  if (cached) return cached;
  const target = await client.request({ to: tab.actor, type: "getTarget" });
  const result = { consoleActor: target.frame.consoleActor as string };
  tabActorCache.set(tab.actor, result);
  return result;
}

async function listTabs(): Promise<BrowserTab[]> {
  if (!client) {
    try {
      await connectToFirefox();
    } catch {
      return [];
    }
  }
  try {
    const resp = await client!.request({ to: "root", type: "listTabs" });
    return (resp.tabs || []).filter(
      (t: BrowserTab) => t.url && t.url !== "about:blank",
    ) as BrowserTab[];
  } catch {
    try {
      await connectToFirefox();
      const resp = await client!.request({ to: "root", type: "listTabs" });
      return (resp.tabs || []).filter(
        (t: BrowserTab) => t.url && t.url !== "about:blank",
      ) as BrowserTab[];
    } catch {
      return [];
    }
  }
}

async function evalInTab(
  tab: BrowserTab,
  expression: string,
  retry = true,
): Promise<string> {
  if (!client) throw new Error("Not connected");
  const { consoleActor } = await getTabActors(tab);

  try {
    return await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client!.removeListener("message", handler);
        reject(new Error("eval timeout"));
      }, 5000);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (msg: any) => {
        if (msg.from === consoleActor && msg.type === "evaluationResult") {
          client!.removeListener("message", handler);
          clearTimeout(timeout);
          if (msg.hasException) {
            reject(new Error(msg.exceptionMessage || "evaluation error"));
          } else {
            resolveGrip(msg.result).then(resolve, reject);
          }
        }
      };
      client!.on("message", handler);
      client!.sendRaw({
        to: consoleActor,
        type: "evaluateJSAsync",
        text: expression,
      });
    });
  } catch (e: unknown) {
    const err = e as Error;
    if (retry && err.message === "eval timeout") {
      tabActorCache.delete(tab.actor);
      return evalInTab(tab, expression, false);
    }
    throw e;
  }
}

async function captureScreenshot(
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
) {
  const dataUrl = await evalInChrome(`
    (async () => {
      const win = Services.wm.getMostRecentWindow("navigator:browser");
      if (!win) throw new Error("no browser window");
      const browser = win.gBrowser.selectedBrowser;
      const bc = browser.browsingContext;
      const snapshot = await bc.currentWindowGlobal.drawSnapshot(
        new DOMRect(${rectX}, ${rectY}, ${rectW}, ${rectH}),
        1.0, "rgb(255,255,255)"
      );
      const MAX = 8000;
      let w = snapshot.width, h = snapshot.height;
      if (w > MAX || h > MAX) {
        const s = Math.min(MAX / w, MAX / h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext("2d");
      ctx.drawImage(snapshot, 0, 0, w, h);
      snapshot.close();
      const blob = await c.convertToBlob({ type: "image/png" });
      const ab = await blob.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return "data:image/png;base64," + btoa(binary);
    })()
  `);

  if (dataUrl.startsWith("data:image/png")) {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    return okImage(actionLine("Captured screenshot", "png attachment"), b64);
  }

  return err("Screenshot failed: " + dataUrl.slice(0, 200));
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}

function okAction(action: string, detailText?: string) {
  return ok(actionLine(action, detailText));
}

function err(text: string) {
  return {
    content: [{ type: "text" as const, text: actionLine("Error", text) }],
    isError: true,
    details: {},
  };
}

function okImage(text: string, b64: string) {
  return {
    content: [
      { type: "text" as const, text },
      { type: "image" as const, data: b64, mimeType: "image/png" },
    ],
    details: {},
  };
}

// --- Extension ---

export default function (pi: ExtensionAPI) {
  pi.on("session_shutdown", () => {
    cleanup();
  });

  type ToolResponse =
    | ReturnType<typeof ok>
    | ReturnType<typeof err>
    | ReturnType<typeof okImage>;

  async function withTab(
    tabIndex: number,
    fn: (tab: BrowserTab) => Promise<ToolResponse>,
  ) {
    const tabs = await listTabs();
    const tab = tabs[tabIndex];
    if (!tab) return err("No tab at that index");
    return fn(tab);
  }

  pi.registerTool({
    name: "launch-browser",
    label: "Launch Firefox",
    description:
      "Launch Firefox with DevTools protocol enabled. Call before other browser tools.",
    parameters: Type.Object({
      url: Type.Optional(Type.String({ description: "URL to open" })),
    }),
    async execute(_id, params) {
      try {
        await launchFirefox(params.url || "about:blank");
        return okAction("Launched Firefox", `port ${DEBUG_PORT}`);
      } catch (e: unknown) {
        return err(`Failed: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "list-browser-tabs",
    label: "List Tabs",
    description: "List open Firefox tabs with their URLs.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const tabs = await listTabs();
        if (tabs.length === 0)
          return okAction("No open tabs", "is Firefox running?");

        const columns: Column[] = [
          { key: "tab", align: "right" },
          { key: "url" },
        ];
        const rows = tabs.map((tab, index) => ({
          tab: index,
          url: tab.url,
        }));

        return ok(
          [
            dotJoin(countLabel(tabs.length, "tab")),
            "",
            table(columns, rows),
          ].join("\n"),
        );
      } catch (e: unknown) {
        return err(`Failed: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "eval-js-in-tab",
    label: "Evaluate JS",
    description:
      "Evaluate a JavaScript expression in a browser tab and return the result.",
    parameters: Type.Object({
      expression: Type.String({ description: "JS expression to evaluate" }),
      tab: Type.Optional(
        Type.Number({ description: "Tab index (default: 0)" }),
      ),
    }),
    async execute(_id, params) {
      try {
        return await withTab(params.tab ?? 0, async (tab) => {
          const result = await evalInTab(tab, params.expression);
          return ok(truncateLines(result));
        });
      } catch (e: unknown) {
        return err(`Error: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "query-dom",
    label: "Query DOM",
    description:
      "Query DOM elements by CSS selector. Returns prettified HTML for matching nodes (devtools-style).",
    parameters: Type.Object({
      selector: Type.String({ description: "CSS selector" }),
      tab: Type.Optional(
        Type.Number({ description: "Tab index (default: 0)" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Max elements to return (default: 10)" }),
      ),
    }),
    async execute(_id, params) {
      try {
        return await withTab(params.tab ?? 0, async (tab) => {
          const limit = params.limit ?? 10;
          const selector = JSON.stringify(params.selector);
          const result = await evalInTab(
            tab,
            `(() => {
              const els = document.querySelectorAll(${selector});
              const shown = Math.min(els.length, ${limit});
              const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

              function escapeText(text) {
                return text
                  .replaceAll("&", "&amp;")
                  .replaceAll("<", "&lt;")
                  .replaceAll(">", "&gt;");
              }

              function renderNode(node, depth) {
                const indent = "  ".repeat(depth);

                if (node.nodeType === Node.TEXT_NODE) {
                  const text = node.textContent ? node.textContent.trim() : "";
                  if (!text) return "";
                  return indent + escapeText(text);
                }

                if (node.nodeType !== Node.ELEMENT_NODE) {
                  return "";
                }

                const el = node;
                const tag = el.tagName.toLowerCase();
                const attrs = Array.from(el.attributes)
                  .map((a) => a.name + "=" + JSON.stringify(a.value))
                  .join(" ");
                const open = "<" + tag + (attrs ? " " + attrs : "") + ">";

                if (VOID_TAGS.has(tag)) {
                  return indent + open;
                }

                const childLines = Array.from(el.childNodes)
                  .map((child) => renderNode(child, depth + 1))
                  .filter((line) => line.length > 0);

                if (childLines.length === 0) {
                  return indent + open + "</" + tag + ">";
                }

                return [indent + open, ...childLines, indent + "</" + tag + ">"].join("\\n");
              }

              const html = [];
              for (let i = 0; i < shown; i++) {
                html.push(renderNode(els[i], 0));
              }

              return JSON.stringify({ total: els.length, shown, html });
            })()`,
          );
          const parsed = JSON.parse(result) as {
            total: number;
            shown: number;
            html: string[];
          };
          const lines: string[] = [
            dotJoin(countLabel(parsed.total, "match"), params.selector),
          ];
          parsed.html.forEach((block, index) => {
            lines.push("");
            lines.push(sectionDivider(`match ${index + 1}`));
            lines.push(block);
          });

          return ok(truncateLines(lines.join("\n")));
        });
      } catch (e: unknown) {
        return err(`Failed: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "navigate-tab",
    label: "Navigate Tab",
    description: "Navigate a tab to a URL.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to navigate to" }),
      tab: Type.Optional(
        Type.Number({ description: "Tab index (default: 0)" }),
      ),
    }),
    async execute(_id, params) {
      try {
        return await withTab(params.tab ?? 0, async (tab) => {
          await evalInTab(
            tab,
            `window.location.href = ${JSON.stringify(params.url)}`,
          );
          return okAction("Navigated tab", params.url);
        });
      } catch (e: unknown) {
        return err(`Failed: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "reload-tab",
    label: "Reload Tab",
    description: "Reload a browser tab.",
    parameters: Type.Object({
      tab: Type.Optional(
        Type.Number({ description: "Tab index (default: 0)" }),
      ),
    }),
    async execute(_id, params) {
      try {
        return await withTab(params.tab ?? 0, async (tab) => {
          await evalInTab(tab, "location.reload()");
          return okAction("Reloaded tab", tab.url);
        });
      } catch (e: unknown) {
        return err(`Failed: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "close-tab",
    label: "Close Tab",
    description: "Close a browser tab by index.",
    parameters: Type.Object({
      tab: Type.Number({ description: "Tab index" }),
    }),
    async execute(_id, params) {
      try {
        return await withTab(params.tab, async (tab) => {
          const url = tab.url;
          await evalInTab(tab, "window.close()");
          return okAction("Closed tab", url);
        });
      } catch (e: unknown) {
        return err(`Failed: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "screenshot-tab",
    label: "Screenshot Tab",
    description:
      "Take a screenshot of the browser viewport. Returns the image as an attachment.",
    parameters: Type.Object({
      tab: Type.Optional(
        Type.Number({ description: "Tab index (default: 0)" }),
      ),
    }),
    async execute(_id, params) {
      try {
        return await withTab(params.tab ?? 0, async (tab) => {
          const scrollPos = await evalInTab(
            tab,
            `JSON.stringify({ x: window.scrollX, y: window.scrollY, w: document.documentElement.clientWidth, h: document.documentElement.clientHeight })`,
          );
          const vp = JSON.parse(scrollPos);
          return await captureScreenshot(vp.x, vp.y, vp.w, vp.h);
        });
      } catch (e: unknown) {
        return err(`Failed: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "screenshot-element",
    label: "Screenshot Element",
    description:
      "Take a screenshot of a specific DOM element by CSS selector. Returns the image as an attachment.",
    parameters: Type.Object({
      selector: Type.String({
        description: "CSS selector of the element to screenshot",
      }),
      tab: Type.Optional(
        Type.Number({ description: "Tab index (default: 0)" }),
      ),
    }),
    async execute(_id, params) {
      try {
        return await withTab(params.tab ?? 0, async (tab) => {
          const boundsJson = await evalInTab(
            tab,
            `(() => {
              const el = document.querySelector(${JSON.stringify(params.selector)});
              if (!el) return "null";
              el.scrollIntoView({ block: "center" });
              const r = el.getBoundingClientRect();
              return JSON.stringify({ x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height });
            })()`,
          );
          const bounds = JSON.parse(boundsJson);
          if (!bounds)
            return err(`No element found for selector: ${params.selector}`);
          await new Promise((r) => setTimeout(r, 300));
          const settled = await evalInTab(
            tab,
            `(() => {
              const el = document.querySelector(${JSON.stringify(params.selector)});
              const r = el.getBoundingClientRect();
              return JSON.stringify({ x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height });
            })()`,
          );
          const s = JSON.parse(settled);
          return await captureScreenshot(s.x, s.y, s.w, s.h);
        });
      } catch (e: unknown) {
        return err(`Failed: ${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "close-browser",
    label: "Close Firefox",
    description: "Kill the Firefox process and clean up the connection.",
    parameters: Type.Object({}),
    async execute() {
      if (!firefoxProcess) return err("Firefox is not running");
      cleanup();
      return okAction("Closed Firefox");
    },
  });
}
