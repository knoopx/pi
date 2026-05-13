type RetryDecision = "throw" | "retry" | "abort";

function classifyError(error: Error): "throw" | null {
  if (error.message.includes("Aborted")) return "throw";
  const statusMatch = error.message.match(/HTTP (\d+)/);
  if (statusMatch && parseInt(statusMatch[1], 10) < 500) return "throw";
  return null;
}

function determineAction(
  error: Error,
  attempt: number,
  maxRetries: number,
): RetryDecision {
  if (classifyError(error) === "throw") return "throw";
  if (attempt >= maxRetries) return "abort";
  return "retry";
}

function computeDelay(attempt: number, baseDelay: number, cap: number): number {
  return Math.min(baseDelay * 2 ** attempt, cap);
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  maxDelay?: number;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelay = options?.retryDelay ?? 500;
  const maxDelay = options?.maxDelay ?? 5000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await runAttempt(fn, attempt, {
      maxRetries,
      retryDelay,
      maxDelay,
    });
    if (result !== undefined) return result;
  }
  throw new Error("Retry loop completed without error");
}

async function runAttempt<T>(
  fn: () => Promise<T>,
  attempt: number,
  opts: { maxRetries: number; retryDelay: number; maxDelay: number },
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const lastError = error instanceof Error ? error : new Error(String(error));
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
        return undefined;
      case "abort":
        throw lastError;
    }
  }
}
