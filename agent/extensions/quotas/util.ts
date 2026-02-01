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
    label: string | ((data: any, windowData: any) => string);
    usedPercentPath?: string;
    usedPercentTransform?: (val: number) => number;
    resetPath?: string;
    fixedLabel?: string;
  }>,
): (data: any) => RateWindow[] {
  return (data) => {
    const result: RateWindow[] = [];

    for (const window of windows) {
      const windowData = window.path
        .split(".")
        .reduce((obj, key) => obj?.[key], data);
      if (!windowData) continue;

      let usedPercent = window.usedPercentPath
        ? window.usedPercentPath
            .split(".")
            .reduce((obj, key) => obj?.[key], windowData) || 0
        : windowData.utilization || windowData.used_percent || 0;

      if (window.usedPercentTransform) {
        usedPercent = window.usedPercentTransform(usedPercent);
      }

      const label =
        typeof window.label === "function"
          ? window.label(data, windowData)
          : window.fixedLabel || window.label;

      let resetAt;
      if (window.resetPath) {
        if (window.resetPath.startsWith("/")) {
          // Absolute path from root data
          resetAt = window.resetPath
            .slice(1)
            .split(".")
            .reduce((obj, key) => obj?.[key], data);
        } else {
          // Relative path from windowData
          resetAt = window.resetPath
            .split(".")
            .reduce((obj, key) => obj?.[key], windowData);
        }
      }
      if (!resetAt) {
        resetAt = windowData.resets_at || windowData.reset_at;
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
      const res = await deps.fetch(config.apiUrl, {
        method: config.method || "GET",
        headers: config.headers(token),
        body: config.body,
      });

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
  tokenSelector?: (data: any) => string | undefined,
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
