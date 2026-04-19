import * as path from "node:path";
import type {
  BaseDependencies,
  UsageSnapshot,
  RateWindow,
  WindowConfig,
  ProviderConfig,
} from "./types";
import {
  createAuthErrorSnapshot,
  createNetworkErrorSnapshot,
  createHttpErrorSnapshot,
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

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Generic processData helper for rate limit windows
export function createRateLimitProcessor(
  windows: WindowConfig[],
): (data: unknown) => RateWindow[] {
  type AnyRecord = Record<string, unknown>;
  const getPath = (obj: unknown, path: string): unknown =>
    path.split(".").reduce((o, k) => (o as AnyRecord)?.[k], obj);

  function extractUsedPercent(data: AnyRecord, cfg: WindowConfig): number {
    let usedPercent = cfg.usedPercentPath
      ? (getPath(data, cfg.usedPercentPath) as number) || 0
      : (data.utilization as number) || (data.used_percent as number) || 0;
    if (cfg.usedPercentTransform)
      usedPercent = cfg.usedPercentTransform(usedPercent);
    return usedPercent;
  }

  function extractLabel(
    root: unknown,
    data: AnyRecord,
    cfg: WindowConfig,
  ): string {
    return typeof cfg.label === "function"
      ? cfg.label(root, data)
      : cfg.fixedLabel || cfg.label;
  }

  function extractResetAt(
    root: unknown,
    data: AnyRecord,
    cfg: WindowConfig,
  ): string | number | undefined {
    let resetAt: string | number | undefined;
    if (cfg.resetPath) {
      resetAt = cfg.resetPath.startsWith("/")
        ? (getPath(root, cfg.resetPath.slice(1)) as string | number | undefined)
        : (getPath(data, cfg.resetPath) as string | number | undefined);
    }
    if (!resetAt)
      resetAt =
        (data.resets_at as string | number | undefined) ||
        (data.reset_at as string | number | undefined);
    return resetAt;
  }

  return (data) => {
    const result: RateWindow[] = [];
    for (const cfg of windows) {
      const windowData = getPath(data, cfg.path) as AnyRecord | undefined;
      if (!windowData) continue;
      result.push({
        label: extractLabel(data, windowData, cfg),
        usedPercent: extractUsedPercent(windowData, cfg),
        resetDescription: extractResetAt(data, windowData, cfg)
          ? formatRemainingDuration(extractResetAt(data, windowData, cfg))
          : undefined,
      });
    }
    return result;
  };
}

export function createGenericProvider(config: ProviderConfig) {
  return async function fetchUsage(
    deps: BaseDependencies,
  ): Promise<UsageSnapshot | null> {
    const token = config.tokenLoader(deps);
    if (!token)
      return createAuthErrorSnapshot(config.provider, config.displayName);

    try {
      const res = (await deps.fetch(config.apiUrl, {
        method: config.method || "GET",
        headers: config.headers(token),
        body: config.body,
      })) as { ok: boolean; status: number; json: () => Promise<unknown> };

      if (!res.ok)
        return createHttpErrorSnapshot(
          config.provider,
          config.displayName,
          res.status,
        );

      const data = await res.json();

      let windows: RateWindow[] = [];
      if (config.customProcessor) windows = config.customProcessor(data);
      else if (config.windows)
        windows = createRateLimitProcessor(config.windows)(data);

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
  if (deps.fileExists(piAuthPath)) {
    const data: Record<string, Record<string, unknown>> = JSON.parse(
      deps.readFile(piAuthPath) ?? "{}",
    ) as Record<string, Record<string, unknown>>;

    const providerData = data[providerKey];
    const token = tokenSelector
      ? tokenSelector(providerData)
      : (providerData?.access as string | undefined) ||
        (providerData?.refresh as string | undefined);

    if (typeof token === "string" && token.length > 0) return token;
  }
  return undefined;
}
