export interface WindowConfig {
  path: string;
  label: string | ((data: unknown, windowData: unknown) => string);
  usedPercentPath?: string;
  usedPercentTransform?: (val: number) => number;
  resetPath?: string;
  fixedLabel?: string;
}
export interface ProviderConfig {
  provider: string;
  displayName: string;
  tokenLoader: (deps: BaseDependencies) => string | undefined;
  apiUrl: string;
  method?: string;
  body?: string;
  headers: (token: string) => Record<string, string>;
  windows?: WindowConfig[];
  customProcessor?: (data: unknown) => RateWindow[];
}

export interface RateWindow {
  label: string;
  usedPercent: number;
  resetDescription?: string;
}
export interface UsageSnapshot {
  provider: string;
  displayName: string;
  windows: RateWindow[];
  error?: string;
}
export interface BaseDependencies {
  homedir(): string;
  fileExists(path: string): boolean;
  readFile(path: string): string | undefined;
  fetch(url: string, options?: Record<string, unknown>): Promise<unknown>;
}

function createErrorSnapshot(
  provider: string,
  displayName: string,
  error: string,
): UsageSnapshot {
  return {
    provider,
    displayName,
    windows: [],
    error,
  };
}

export function createAuthErrorSnapshot(
  provider: string,
  displayName: string,
): UsageSnapshot {
  return createErrorSnapshot(provider, displayName, "No credentials found");
}

export function createNetworkErrorSnapshot(
  provider: string,
  displayName: string,
): UsageSnapshot {
  return createErrorSnapshot(provider, displayName, "Network error");
}

export function createHttpErrorSnapshot(
  provider: string,
  displayName: string,
  status: number,
): UsageSnapshot {
  const error = `HTTP ${status}: ${status === 401 ? "Unauthorized" : "API Error"}`;
  return createErrorSnapshot(provider, displayName, error);
}
