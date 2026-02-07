export interface ProviderConfig {
  provider: string;
  displayName: string;
  tokenLoader: (deps: BaseDependencies) => string | undefined;
  apiUrl: string;
  method?: string;
  body?: string;
  headers: (token: string) => Record<string, string>;
  windows?: Array<{
    path: string;
    label: string | ((data: unknown, windowData: unknown) => string);
    usedPercentPath?: string;
    usedPercentTransform?: (val: number) => number;
    resetPath?: string;
    fixedLabel?: string;
  }>;
  customProcessor?: (data: unknown) => RateWindow[];
}

// Shared types for quota providers
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

// Helper function to create error snapshots
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

// Helper function to create auth error snapshots
export function createAuthErrorSnapshot(
  provider: string,
  displayName: string,
): UsageSnapshot {
  return createErrorSnapshot(provider, displayName, "No credentials found");
}

// Helper function to create network error snapshots
export function createNetworkErrorSnapshot(
  provider: string,
  displayName: string,
): UsageSnapshot {
  return createErrorSnapshot(provider, displayName, "Network error");
}

// Helper function to create HTTP error snapshots
export function createHttpErrorSnapshot(
  provider: string,
  displayName: string,
  status: number,
): UsageSnapshot {
  const error = `HTTP ${status}: ${status === 401 ? "Unauthorized" : "API Error"}`;
  return createErrorSnapshot(provider, displayName, error);
}
