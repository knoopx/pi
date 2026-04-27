import type { RetryOptions } from "./retry";

export const FETCH_OPTIONS: RetryOptions = {
  maxRetries: 2,
  retryDelay: 500,
};

/**
 * Consistent browser-like headers used across all HTTP requests.
 * Mimics a real Chrome browser to avoid being blocked by anti-bot measures.
 */
export const BROWSER_HEADERS = Object.freeze({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
});
