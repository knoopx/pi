import * as path from "node:path";
import {
  BaseDependencies,
  UsageSnapshot,
  RateWindow,
  createAuthErrorSnapshot,
  createNetworkErrorSnapshot,
  createHttpErrorSnapshot,
  ProviderConfig,
} from "./types";

// Shared utility function to format remaining duration
export function formatRemainingDuration(
  resetAt: string | number | undefined,
): string | undefined {
  if (!resetAt) return undefined;

  const resetDate =
    typeof resetAt === "string" ? new Date(resetAt) : new Date(resetAt * 1000);
  const now = new Date();
  const remainingMs = resetDate.getTime() - now.getTime();

  if (remainingMs <= 0) return "resetting...";

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Generic processData helper for rate limit windows
export function createRateLimitProcessor(
  windows: Array<{
    path: string;
    label: string | ((data: unknown, windowData: unknown) => string);
    usedPercentPath?: string;
    usedPercentTransform?: (val: number) => number;
    resetPath?: string;
    fixedLabel?: string;
  }>,
): (data: unknown) => RateWindow[] {
  type AnyRecord = Record<string, unknown>;
  const getPath = (obj: unknown, path: string): unknown =>
    path.split(".").reduce((o, k) => (o as AnyRecord)?.[k], obj);

  return (data) => {
    const result: RateWindow[] = [];

    for (const window of windows) {
      const windowData = getPath(data, window.path) as AnyRecord | undefined;
      if (!windowData) continue;

      let usedPercent = window.usedPercentPath
        ? (getPath(windowData, window.usedPercentPath) as number) || 0
        : (windowData.utilization as number) ||
          (windowData.used_percent as number) ||
          0;

      if (window.usedPercentTransform) {
        usedPercent = window.usedPercentTransform(usedPercent);
      }

      const label =
        typeof window.label === "function"
          ? window.label(data, windowData)
          : window.fixedLabel || window.label;

      let resetAt: string | number | undefined;
      if (window.resetPath) {
        if (window.resetPath.startsWith("/")) {
          // Absolute path from root data
          resetAt = getPath(data, window.resetPath.slice(1)) as
            | string
            | number
            | undefined;
        } else {
          // Relative path from windowData
          resetAt = getPath(windowData, window.resetPath) as
            | string
            | number
            | undefined;
        }
      }
      if (!resetAt) {
        resetAt =
          (windowData.resets_at as string | number | undefined) ||
          (windowData.reset_at as string | number | undefined);
      }

      result.push({
        label,
        usedPercent,
        resetDescription: resetAt
          ? formatRemainingDuration(resetAt)
          : undefined,
      });
    }

    return result;
  };
}

export async function createGenericProvider(config: ProviderConfig) {
  return async function fetchUsage(
    deps: BaseDependencies,
  ): Promise<UsageSnapshot | null> {
    const token = config.tokenLoader(deps);
    if (!token) {
      return createAuthErrorSnapshot(config.provider, config.displayName);
    }

    try {
      const res = (await deps.fetch(config.apiUrl, {
        method: config.method || "GET",
        headers: config.headers(token),
        body: config.body,
      })) as { ok: boolean; status: number; json: () => Promise<unknown> };

      if (!res.ok) {
        return createHttpErrorSnapshot(
          config.provider,
          config.displayName,
          res.status,
        );
      }

      const data = await res.json();

      let windows: RateWindow[] = [];
      if (config.customProcessor) {
        windows = config.customProcessor(data);
      } else if (config.windows) {
        windows = createRateLimitProcessor(config.windows)(data);
      }

      return {
        provider: config.provider,
        displayName: config.displayName,
        windows,
      };
    } catch {
      return createNetworkErrorSnapshot(config.provider, config.displayName);
    }
  };
}

export function loadTokenFromPiAuthJson(
  deps: BaseDependencies,
  providerKey: string,
  tokenSelector?: (data: Record<string, unknown>) => string | undefined,
): string | undefined {
  const piAuthPath = path.join(deps.homedir(), ".pi", "agent", "auth.json");
  try {
    if (deps.fileExists(piAuthPath)) {
      const data = JSON.parse(deps.readFile(piAuthPath) ?? "{}");
      const token = tokenSelector
        ? tokenSelector(data)
        : data[providerKey]?.access || data[providerKey]?.refresh;
      if (typeof token === "string" && token.length > 0) return token;
    }
  } catch {}
  return undefined;
}
