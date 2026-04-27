export interface RetryOptions {
  /** Maximum number of retries (default: 2) */
  maxRetries?: number;
  /** Delay before retrying (default: 500ms) */
  retryDelay?: number;
  /** Maximum delay cap in milliseconds (default: 5000) */
  maxDelay?: number;
}

type Action = "throw" | "break" | "delay";
type Outcome =
  | { action: "throw" }
  | { action: "break" }
  | { action: "delay"; delay: number };

function classifyError(error: Error): Outcome | null {
  if (error.message.includes("Aborted")) return { action: "throw" };
  const statusMatch = error.message.match(/HTTP (\d+)/);
  if (statusMatch && parseInt(statusMatch[1], 10) < 500)
    return { action: "throw" };
  return null;
}

/**
 * Retry an async operation with exponential backoff.
 * Retries on transient errors (network failures, 5xx HTTP responses).
 * Does not retry on client errors (4xx), aborts, or non-retryable errors.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelay = options?.retryDelay ?? 500;
  const maxDelay = options?.maxDelay ?? 5000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const action = getRetryAction(lastError, attempt, maxRetries);
      if (action === "throw") throw lastError;
      if (action === "break") break;
      await new Promise((resolve) =>
        setTimeout(resolve, getDelay(attempt, retryDelay, maxDelay)),
      );
    }
  }

  throw lastError!;
}

function getRetryAction(
  error: Error,
  attempt: number,
  maxRetries: number,
): Action {
  const classified = classifyError(error);
  if (classified) return "throw";
  if (attempt >= maxRetries) return "break";
  return "delay";
}

function getDelay(
  attempt: number,
  retryDelay: number,
  maxDelay: number,
): number {
  return Math.min(retryDelay * 2 ** attempt, maxDelay);
}

/**
 * Wrapper for fetch that adds retry logic and returns text.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit & { signal?: AbortSignal },
  options?: RetryOptions,
): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> {
  return retry(async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return {
      ok: true,
      status: res.status,
      text: () => res.text(),
    };
  }, options);
}
