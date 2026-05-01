import { BROWSER_HEADERS, FETCH_OPTIONS } from "./constants";
import { retry } from "./retry";
import type { RetryOptions } from "./retry";
import type { Parser } from "./types";

export function defineParser<T>(
  domain: string,
  matches: (url: string) => boolean,
  parse: (url: string) => T | null,
  convert: (parsed: T, signal?: AbortSignal) => Promise<string>,
): Parser {
  return {
    matches,
    convert: async (url: string, signal?: AbortSignal): Promise<string> => {
      const parsed = parse(url);
      if (!parsed) throw new Error(`Unable to parse ${domain} URL: ${url}`);
      return convert(parsed, signal);
    },
  };
}

export interface VersionedPackagePath {
  kind: "package" | "version";
  name: string;
  version?: string;
}

export function createVersionedPackageParser(
  pattern: RegExp,
): (url: string) => VersionedPackagePath | null {
  return (url: string): VersionedPackagePath | null => {
    const match = url.match(pattern);
    if (!match) return null;

    const name = decodeURIComponent(match[1]);

    const fullMatch = url.match(new RegExp(pattern.source + "(?:\\/(.+))?$"));
    if (fullMatch?.[2]) {
      const rest = fullMatch[2];
      if (/^\d+\./.test(rest) || rest.startsWith("v")) {
        return { kind: "version", name, version: rest };
      }
    }

    return { kind: "package", name };
  };
}

export function requireVersion(parsed: VersionedPackagePath): string {
  if (!parsed.version) throw new Error("Missing version");
  return parsed.version;
}

export interface RetryFetchOptions {
  apiName: string;
  headers?: Record<string, string>;
  retryOpts?: RetryOptions;
}

function createRetryFetchBase(
  opts: RetryFetchOptions,
): (url: string, signal?: AbortSignal) => Promise<Response> {
  const headers = opts.headers ?? BROWSER_HEADERS;
  const retryOpts = opts.retryOpts ?? FETCH_OPTIONS;
  return async (url: string, signal?: AbortSignal): Promise<Response> => {
    return retry(async () => {
      const res = await fetch(url, { headers, signal });
      if (!res.ok)
        throw new Error(`${opts.apiName} API ${res.status}: ${res.statusText}`);
      return res;
    }, retryOpts);
  };
}

export function createRetryFetch(
  opts: RetryFetchOptions,
): <T>(url: string, signal?: AbortSignal) => Promise<T> {
  const fetchResp = createRetryFetchBase(opts);
  return async <T>(url: string, signal?: AbortSignal): Promise<T> => {
    return (await fetchResp(url, signal)).json() as Promise<T>;
  };
}

export function createRetryFetchText(
  opts: RetryFetchOptions,
): (url: string, signal?: AbortSignal) => Promise<string> {
  const fetchResp = createRetryFetchBase(opts);
  return async (url: string, signal?: AbortSignal): Promise<string> => {
    return (await fetchResp(url, signal)).text();
  };
}
