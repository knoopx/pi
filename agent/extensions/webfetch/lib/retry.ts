function classifyError(error: Error): boolean {
  if (error.message.includes("Aborted")) return true;
  const statusMatch = error.message.match(/HTTP (\d+)/);
  return !!(statusMatch && parseInt(statusMatch[1], 10) < 500);
}

function computeDelay(attempt: number, baseDelay: number, cap: number): number {
  return Math.min(baseDelay * 2 ** attempt, cap);
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  maxDelay?: number;
}

function resolveRetryOptions(options: RetryOptions = {}): {
  maxRetries: number;
  retryDelay: number;
  maxDelay: number;
} {
  return {
    maxRetries: options.maxRetries ?? 2,
    retryDelay: options.retryDelay ?? 500,
    maxDelay: options.maxDelay ?? 5000,
  };
}

export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = resolveRetryOptions(options);

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const result = await runAttempt(fn, attempt, opts);
    if (result !== undefined) return result;
  }
  throw new Error("Retry loop completed without error");
}

function captureError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function runAttempt<T>(
  fn: () => Promise<T>,
  attempt: number,
  opts: { maxRetries: number; retryDelay: number; maxDelay: number },
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const lastError = captureError(error);
    if (classifyError(lastError)) throw lastError;
    if (attempt >= opts.maxRetries) throw lastError;
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        computeDelay(attempt, opts.retryDelay, opts.maxDelay),
      ),
    );
    return undefined;
  }
}
