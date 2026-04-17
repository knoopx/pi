import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import * as os from "node:os";
import type { BaseDependencies } from "./types";

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface HttpResponse {
  ok: boolean;
  status: number | undefined;
  json: () => Promise<unknown>;
}

function safeFsOperation<T>(operation: () => T, fallback: T): T {
  try {
    return operation();
  } catch {
    return fallback;
  }
}

function handleResponse(
  res: http.IncomingMessage,
  data: string,
  resolve: (value: HttpResponse) => void,
): void {
  const ok = Boolean(
    res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
  );
  try {
    const jsonData = data ? JSON.parse(data) : {};
    resolve({ ok, status: res.statusCode, json: async () => jsonData });
  } catch {
    resolve({ ok, status: res.statusCode, json: async () => ({}) });
  }
}

async function nodeFetch(
  url: string,
  options: FetchOptions = {},
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: 10_000,
    };

    const req = (isHttps ? https : http).request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => { handleResponse(res, data, resolve); });
    });

    req.on("error", (error) => {
      reject(error);
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

export function createDefaultDependencies(): BaseDependencies {
  return {
    homedir: () => os.homedir(),
    fileExists: (filePath) =>
      safeFsOperation(() => fs.statSync(filePath).isFile(), false),
    readFile: (filePath) =>
      safeFsOperation(() => fs.readFileSync(filePath, "utf-8"), undefined),
    fetch: nodeFetch,
  };
}
