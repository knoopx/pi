export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  maxDelay?: number;
}
type Outcome = { action: "throw" } | { action: "break" };
type RetryDecision = "throw" | "retry" | "abort";

function classifyError(error: Error): Outcome | null {
  if (error.message.includes("Aborted")) return { action: "throw" };
  const statusMatch = error.message.match(/HTTP (\d+)/);
  if (statusMatch && parseInt(statusMatch[1], 10) < 500)
    return { action: "throw" };
  return null;
}

function determineAction(
  error: Error,
  attempt: number,
  maxRetries: number,
): RetryDecision {
  const classified = classifyError(error);
  if (classified?.action === "throw") return "throw";
  if (attempt >= maxRetries) return "abort";
  return "retry";
}

function computeDelay(attempt: number, baseDelay: number, cap: number): number {
  return Math.min(baseDelay * 2 ** attempt, cap);
}

export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelay = options?.retryDelay ?? 500;
  const maxDelay = options?.maxDelay ?? 5000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await runAttempt(fn, attempt, { maxRetries, retryDelay, maxDelay });
  }
  throw new Error("Retry loop completed without error");
}

async function runAttempt<T>(
  fn: () => Promise<T>,
  attempt: number,
  opts: { maxRetries: number; retryDelay: number; maxDelay: number },
): Promise<void> {
  let lastError: Error | undefined;

  try {
    await fn();
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    const decision = determineAction(lastError, attempt, opts.maxRetries);
    switch (decision) {
      case "throw":
        throw lastError;
      case "retry":
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            computeDelay(attempt, opts.retryDelay, opts.maxDelay),
          ),
        );
        return; // continue to next loop iteration
      case "abort":
        break;
    }
  }
}

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
