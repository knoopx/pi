import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as https from "node:https";
import * as http from "node:http";
import * as os from "node:os";
import { fetchAnthropicUsage } from "./providers/anthropic";
import { fetchOpenAIUsage } from "./providers/openai";
import { fetchCopilotUsage } from "./providers/copilot";
import { fetchGeminiUsage } from "./providers/gemini";
import { BaseDependencies, UsageSnapshot } from "./types";

interface Dependencies extends BaseDependencies {
  env: Record<string, string | undefined>;
}

// Helper to create file system operations with error handling
function createFsOperation<T>(operation: () => T, fallback?: T): T {
  try {
    return operation();
  } catch {
    return fallback as T;
  }
}

// Simple fetch implementation using Node.js built-ins
interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function nodeFetch(
  url: string,
  options: FetchOptions = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: 10000, // 10 second timeout
    };

    const req = (isHttps ? https : http).request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve(jsonData),
          });
        } catch {
          resolve({
            ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve({}),
          });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// File system operation factory
const fsOp =
  <T>(op: (path: string) => T, fallback: T) =>
  (path: string) =>
    createFsOperation(() => op(path), fallback);

const deps: Dependencies = {
  homedir: () => os.homedir(),
  fileExists: fsOp((p) => fs.statSync(p).isFile(), false),
  readFile: fsOp((p) => fs.readFileSync(p, "utf-8"), undefined),
  env: process.env,
  fetch: nodeFetch,
};

function formatUsage(usage: UsageSnapshot): string {
  if (usage.error) {
    return `${usage.displayName}: ${usage.error}`;
  }

  if (usage.windows.length === 0) {
    return `${usage.displayName}: No usage data`;
  }

  const windowTexts = usage.windows.map((window) => {
    const percent = Math.round(window.usedPercent);
    const reset = window.resetDescription
      ? ` (${window.resetDescription})`
      : "";
    return `${window.label}: ${percent}% used${reset}`;
  });

  return `${usage.displayName} - ${windowTexts.join(", ")}`;
}

export default function quotasExtension(pi: ExtensionAPI) {
  let currentUsage: UsageSnapshot | undefined;
  let lastContext: ExtensionContext | undefined;

  function detectAndFetchUsage(
    model: { provider?: string; id?: string } | undefined,
  ): Promise<UsageSnapshot | null> {
    const provider = model?.provider?.toLowerCase() ?? "";
    const id = model?.id?.toLowerCase() ?? "";

    if (provider.includes("anthropic") || id.includes("claude")) {
      return fetchAnthropicUsage(deps);
    } else if (provider.includes("openai") || id.includes("gpt")) {
      return fetchOpenAIUsage(deps);
    } else if (provider.includes("github") || provider.includes("copilot")) {
      return fetchCopilotUsage(deps);
    } else if (provider.includes("google") || id.includes("gemini")) {
      return fetchGeminiUsage(deps);
    }
    return Promise.resolve(null);
  }

  async function refreshUsage() {
    // Try to detect provider from current model
    const model = lastContext?.model;
    const usage = await detectAndFetchUsage(model);

    currentUsage = usage || undefined;

    // Update widget
    if (lastContext && currentUsage) {
      lastContext.ui.setWidget(
        "quotas",
        (_tui: unknown, _theme: unknown) => ({
          render: (_width: number) => [formatUsage(currentUsage!)],
          invalidate: () => {},
        }),
        { placement: "belowEditor" },
      );
    } else if (lastContext) {
      lastContext.ui.setWidget("quotas", undefined);
    }
  }

  pi.registerCommand("quotas:refresh", {
    description: "Refresh quotas and limits data",
    handler: async () => {
      await refreshUsage();
    },
  });

  // Register context-setting event handlers
  const handleContextEvent = async (_event: unknown, ctx: ExtensionContext) => {
    lastContext = ctx;
    await refreshUsage();
  };
  pi.on("session_start", handleContextEvent);
  pi.on("model_select", handleContextEvent);

  // Auto-refresh every 5 minutes
  setInterval(refreshUsage, 5 * 60 * 1000);
}
