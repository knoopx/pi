/**
 * Provider Status Bar Extension
 * Displays usage stats for AI providers with configured authentication.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { visibleWidth } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

// ============================================================================
// Types
// ============================================================================

interface RateWindow {
  label: string;
  usedPercent: number;
  resetDescription?: string;
  resetsAt?: Date;
  remaining?: number;
  entitlement?: number;
}

interface ProviderStatus {
  indicator:
    | "none"
    | "minor"
    | "major"
    | "critical"
    | "maintenance"
    | "unknown";
  description?: string;
}

interface UsageSnapshot {
  provider: string;
  displayName: string;
  windows: RateWindow[];
  plan?: string;
  error?: string;
  status?: ProviderStatus;
}

interface ConfiguredProvider {
  key: string;
  fetch: () => Promise<UsageSnapshot>;
  status?: () => Promise<ProviderStatus>;
}

// ============================================================================
// Utilities
// ============================================================================

// Common HTTP request utility with timeout and error handling
async function fetchWithTimeout(
  url: string,
  options: any = {},
  timeoutMs: number = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  }
}

// Common token loading from pi auth.json
function loadTokenFromPiAuth(
  provider: string,
  tokenKey: string = "access",
): string | undefined {
  const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
  if (!fs.existsSync(authPath)) return undefined;
  const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
  return data[provider]?.[tokenKey];
}

// Common error response creation
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

// Common timeout wrapper for promises
function timeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
  ]);
}

// Generic token loader with fallbacks
function createTokenLoader(
  primaryLoader: () => string | undefined,
  ...fallbacks: (() => string | undefined)[]
): () => string | undefined {
  return () => {
    let token = primaryLoader();
    if (token) return token;

    for (const fallback of fallbacks) {
      token = fallback();
      if (token) return token;
    }

    return undefined;
  };
}

// Generic fetch wrapper with common error handling
async function fetchUsageWithErrorHandling(
  provider: string,
  displayName: string,
  tokenLoader: () => string | undefined,
  fetchFn: (token: string) => Promise<UsageSnapshot>,
): Promise<UsageSnapshot> {
  const token = tokenLoader();
  if (!token) {
    return createErrorSnapshot(provider, displayName, "No credentials");
  }

  try {
    return await fetchFn(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorSnapshot(provider, displayName, message);
  }
}

// ============================================================================
// Provider Fetch Map
// ============================================================================

const PROVIDER_FETCH_MAP: Record<
  string,
  {
    fetch: (modelRegistry: any) => Promise<UsageSnapshot>;
    status?: () => Promise<ProviderStatus>;
  }
> = {
  // anthropic: {
  //   fetch: () => fetchClaudeUsage(),
  //   status: () => fetchProviderStatus("anthropic"),
  // },
  // "github-copilot": {
  //   fetch: (modelRegistry) => fetchCopilotUsage(modelRegistry),
  //   status: () => fetchProviderStatus("copilot"),
  // },
  // "google-antigravity": {
  //   fetch: (modelRegistry) => fetchAntigravityUsage(modelRegistry),
  // },
  // "google-gemini-cli": {
  //   fetch: (modelRegistry) => fetchGeminiUsage(modelRegistry),
  //   status: () => fetchGeminiStatus(),
  // },
  // "openai-codex": {
  //   fetch: (modelRegistry) => fetchCodexUsage(modelRegistry),
  //   status: () => fetchProviderStatus("codex"),
  // },
};

// ============================================================================
// Provider Configuration
// ============================================================================

function getConfiguredProviders(modelRegistry: any): ConfiguredProvider[] {
  const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
  if (!fs.existsSync(authPath)) return [];
  const auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));

  const configured: ConfiguredProvider[] = [];
  for (const providerKey of Object.keys(auth)) {
    if (PROVIDER_FETCH_MAP[providerKey]) {
      configured.push({
        key: providerKey,
        fetch: () => PROVIDER_FETCH_MAP[providerKey].fetch(modelRegistry),
        status: PROVIDER_FETCH_MAP[providerKey].status,
      });
    }
  }

  return configured;
}

// ============================================================================
// Status Fetching
// ============================================================================

const STATUS_URLS: Record<string, string> = {
  anthropic: "https://status.anthropic.com/api/v2/status.json",
  codex: "https://status.openai.com/api/v2/status.json",
  copilot: "https://www.githubstatus.com/api/v2/status.json",
};

async function fetchProviderStatus(provider: string): Promise<ProviderStatus> {
  const url = STATUS_URLS[provider];
  if (!url) return { indicator: "none" };

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5000);

  const res = await fetch(url, { signal: controller.signal });
  if (!res.ok) return { indicator: "unknown" };

  const data = (await res.json()) as any;
  const indicator = data.status?.indicator || "none";
  const description = data.status?.description;

  return {
    indicator: indicator as ProviderStatus["indicator"],
    description,
  };
}

async function fetchGeminiStatus(): Promise<ProviderStatus> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5000);

  const res = await fetch(
    "https://www.google.com/appsstatus/dashboard/incidents.json",
    {
      signal: controller.signal,
    },
  );
  if (!res.ok) return { indicator: "unknown" };

  const incidents = (await res.json()) as any[];

  // Look for active Gemini incidents (product ID: npdyhgECDJ6tB66MxXyo)
  const geminiProductId = "npdyhgECDJ6tB66MxXyo";
  const activeIncidents = incidents.filter((inc: any) => {
    if (inc.end) return false; // Not active
    const affected =
      inc.currently_affected_products || inc.affected_products || [];
    return affected.some((p: any) => p.id === geminiProductId);
  });

  if (activeIncidents.length === 0) {
    return { indicator: "none" };
  }

  // Find most severe
  let worstIndicator: ProviderStatus["indicator"] = "minor";
  let description: string | undefined;

  for (const inc of activeIncidents) {
    const status = inc.most_recent_update?.status || inc.status_impact;
    if (status === "SERVICE_OUTAGE") {
      worstIndicator = "critical";
      description = inc.external_desc;
    } else if (
      status === "SERVICE_DISRUPTION" &&
      worstIndicator !== "critical"
    ) {
      worstIndicator = "major";
      description = inc.external_desc;
    }
  }

  return { indicator: worstIndicator, description };
}

// ============================================================================
// Claude Usage
// ============================================================================

function loadClaudeToken(): string | undefined {
  const loader = createTokenLoader(
    () => loadTokenFromPiAuth("anthropic"),
    () => {
      // Fallback to Claude CLI keychain (macOS)
      const keychainData = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      ).trim();
      if (keychainData) {
        const parsed = JSON.parse(keychainData);
        const scopes = parsed.claudeAiOauth?.scopes || [];
        if (
          scopes.includes("user:profile") &&
          parsed.claudeAiOauth?.accessToken
        ) {
          return parsed.claudeAiOauth.accessToken;
        }
      }
      return undefined;
    },
  );
  return loader();
}

async function fetchClaudeUsage(): Promise<UsageSnapshot> {
  return fetchUsageWithErrorHandling(
    "anthropic",
    "Claude",
    loadClaudeToken,
    async (token) => {
      const res = await fetchWithTimeout(
        "https://api.anthropic.com/api/oauth/usage",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "anthropic-beta": "oauth-2025-04-20",
          },
        },
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const windows: RateWindow[] = [];

      if (data.five_hour?.utilization !== undefined) {
        windows.push({
          label: "5h",
          usedPercent: data.five_hour.utilization,
          resetDescription: data.five_hour.resets_at
            ? formatReset(new Date(data.five_hour.resets_at))
            : undefined,
        });
      }

      if (data.seven_day?.utilization !== undefined) {
        windows.push({
          label: "Week",
          usedPercent: data.seven_day.utilization,
          resetDescription: data.seven_day.resets_at
            ? formatReset(new Date(data.seven_day.resets_at))
            : undefined,
        });
      }

      const modelWindow = data.seven_day_sonnet || data.seven_day_opus;
      if (modelWindow?.utilization !== undefined) {
        windows.push({
          label: data.seven_day_sonnet ? "Sonnet" : "Opus",
          usedPercent: modelWindow.utilization,
        });
      }

      return { provider: "anthropic", displayName: "Claude", windows };
    },
  );
}

// ============================================================================
// Copilot Usage
// ============================================================================

function loadCopilotRefreshToken(): string | undefined {
  // The copilot_internal/user endpoint needs the GitHub OAuth token (ghu_*),
  // NOT the Copilot session token (tid=*). The refresh token IS the GitHub OAuth token.
  return loadTokenFromPiAuth("github-copilot", "refresh");
}

async function fetchCopilotUsage(_modelRegistry: any): Promise<UsageSnapshot> {
  return fetchUsageWithErrorHandling(
    "github-copilot",
    "Copilot",
    loadCopilotRefreshToken,
    async (token) => {
      const headersBase = {
        "Editor-Version": "vscode/1.96.2",
        "User-Agent": "GitHubCopilotChat/0.26.7",
        "X-Github-Api-Version": "2025-04-01",
        Accept: "application/json",
      };

      const tryFetch = async (authHeader: string) => {
        return fetchWithTimeout(
          "https://api.github.com/copilot_internal/user",
          {
            headers: {
              ...headersBase,
              Authorization: authHeader,
            },
          },
        );
      };

      // Copilot access tokens (from /login github-copilot) expect Bearer. PATs accept "token".
      // GitHub OAuth token (ghu_*) requires "token" prefix, not Bearer
      const attempts = [`token ${token}`];
      let lastStatus: number | undefined;
      let res: Response | undefined;

      for (const auth of attempts) {
        res = await tryFetch(auth);
        lastStatus = res.status;
        if (res.ok) break;
        if (res.status === 401 || res.status === 403) continue; // try next scheme
        break;
      }

      if (!res || !res.ok) {
        const status = lastStatus ?? 0;
        throw new Error(`HTTP ${status}`);
      }

      const data = (await res.json()) as any;
      const windows: RateWindow[] = [];

      // Parse reset date for display
      const resetDate = data.quota_reset_date_utc
        ? new Date(data.quota_reset_date_utc)
        : undefined;

      // Premium interactions (e.g., Claude, o1 models) - has a cap
      if (data.quota_snapshots?.premium_interactions) {
        const pi = data.quota_snapshots.premium_interactions;
        const remaining =
          typeof pi.remaining === "number" ? pi.remaining : undefined;
        const entitlement =
          typeof pi.entitlement === "number" ? pi.entitlement : undefined;
        const usedPercent = Math.max(0, 100 - (pi.percent_remaining || 0));
        windows.push({
          label: "Premium",
          usedPercent,
          resetsAt: resetDate,
          remaining,
          entitlement,
          resetDescription: formatUsageDetails(
            resetDate,
            remaining,
            entitlement,
          ),
        });
      }

      // Chat quota - often unlimited, only show if limited
      if (data.quota_snapshots?.chat && !data.quota_snapshots.chat.unlimited) {
        const chat = data.quota_snapshots.chat;
        const remaining =
          typeof chat.remaining === "number" ? chat.remaining : undefined;
        const entitlement =
          typeof chat.entitlement === "number" ? chat.entitlement : undefined;
        windows.push({
          label: "Chat",
          usedPercent: Math.max(0, 100 - (chat.percent_remaining || 0)),
          resetsAt: resetDate,
          remaining,
          entitlement,
          resetDescription: formatUsageDetails(
            resetDate,
            remaining,
            entitlement,
          ),
        });
      }

      return {
        provider: "github-copilot",
        displayName: "Copilot",
        windows,
        plan: data.copilot_plan,
      };
    },
  );
}

// ============================================================================
// Gemini Usage
// ============================================================================

async function fetchGeminiUsage(_modelRegistry: any): Promise<UsageSnapshot> {
  let token: string | undefined;

  // Read directly from pi's auth.json
  const piAuthPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
  try {
    if (fs.existsSync(piAuthPath)) {
      const data = JSON.parse(fs.readFileSync(piAuthPath, "utf-8"));
      token = data["google-gemini-cli"]?.access;
    }
  } catch {}

  // Fallback to ~/.gemini/oauth_creds.json
  if (!token) {
    const credPath = path.join(os.homedir(), ".gemini", "oauth_creds.json");
    try {
      if (fs.existsSync(credPath)) {
        const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
        token = data.access_token;
      }
    } catch {}
  }

  if (!token) {
    return {
      provider: "google-gemini-cli",
      displayName: "Gemini",
      windows: [],
      error: "No credentials",
    };
  }

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      return {
        provider: "google-gemini-cli",
        displayName: "Gemini",
        windows: [],
        error: `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as any;
    const quotas: Record<string, number> = {};

    for (const bucket of data.buckets || []) {
      const model = bucket.modelId || "unknown";
      const frac = bucket.remainingFraction ?? 1;
      if (!quotas[model] || frac < quotas[model]) quotas[model] = frac;
    }

    const windows: RateWindow[] = [];
    let proMin = 1,
      flashMin = 1;
    let hasProModel = false,
      hasFlashModel = false;

    for (const [model, frac] of Object.entries(quotas)) {
      if (model.toLowerCase().includes("pro")) {
        hasProModel = true;
        if (frac < proMin) proMin = frac;
      }
      if (model.toLowerCase().includes("flash")) {
        hasFlashModel = true;
        if (frac < flashMin) flashMin = frac;
      }
    }

    // Always show windows if model exists (even at 0% usage)
    if (hasProModel)
      windows.push({ label: "Pro", usedPercent: (1 - proMin) * 100 });
    if (hasFlashModel)
      windows.push({ label: "Flash", usedPercent: (1 - flashMin) * 100 });

    return { provider: "google-gemini-cli", displayName: "Gemini", windows };
  } catch (e) {
    return {
      provider: "google-gemini-cli",
      displayName: "Gemini",
      windows: [],
      error: String(e),
    };
  }
}

// ============================================================================
// Antigravity Usage
// ============================================================================

type AntigravityAuth = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  projectId?: string;
};

function loadAntigravityAuthFromPiAuthJson(): AntigravityAuth | undefined {
  const piAuthPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
  if (!fs.existsSync(piAuthPath)) return undefined;
  const data = JSON.parse(fs.readFileSync(piAuthPath, "utf-8"));

  // Provider is called "google-antigravity" in pi.
  const cred =
    data["google-antigravity"] ?? data["antigravity"] ?? data["anti-gravity"];
  if (!cred) return undefined;

  const accessToken = typeof cred.access === "string" ? cred.access : undefined;
  if (!accessToken) return undefined;

  return {
    accessToken,
    refreshToken: typeof cred.refresh === "string" ? cred.refresh : undefined,
    expiresAt: typeof cred.expires === "number" ? cred.expires : undefined,
    projectId:
      typeof cred.projectId === "string"
        ? cred.projectId
        : typeof cred.project_id === "string"
          ? cred.project_id
          : undefined,
  };
}

async function loadAntigravityAuth(
  _modelRegistry: any,
): Promise<AntigravityAuth | undefined> {
  // Prefer model registry auth storage first (may auto-refresh).
  const accessToken = await Promise.resolve(
    _modelRegistry?.authStorage?.getApiKey?.("google-antigravity"),
  );
  const raw = await Promise.resolve(
    _modelRegistry?.authStorage?.get?.("google-antigravity"),
  );

  const projectId =
    typeof raw?.projectId === "string" ? raw.projectId : undefined;
  const refreshToken =
    typeof raw?.refresh === "string" ? raw.refresh : undefined;
  const expiresAt = typeof raw?.expires === "number" ? raw.expires : undefined;

  if (typeof accessToken === "string" && accessToken.length > 0) {
    return { accessToken, projectId, refreshToken, expiresAt };
  }

  // Fallback to pi auth.json
  const fromPi = loadAntigravityAuthFromPiAuthJson();
  if (fromPi) return fromPi;

  // Last resort: env var (won't have projectId; request will likely fail)
  if (process.env.ANTIGRAVITY_API_KEY) {
    return { accessToken: process.env.ANTIGRAVITY_API_KEY };
  }

  return undefined;
}

async function refreshAntigravityAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt?: number } | null> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5000);

  // From the reference snippet in CodexBar issue #129.
  const clientId =
    "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
  const clientSecret = "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";

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    signal: controller.signal,
  });

  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const accessToken =
    typeof data.access_token === "string" ? data.access_token : undefined;
  if (!accessToken) return null;
  const expiresIn =
    typeof data.expires_in === "number" ? data.expires_in : undefined;
  return {
    accessToken,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
  };
}

async function fetchAntigravityUsage(
  _modelRegistry: any,
): Promise<UsageSnapshot> {
  const auth = await loadAntigravityAuth(_modelRegistry);
  if (!auth?.accessToken) {
    return createErrorSnapshot(
      "google-antigravity",
      "Antigravity",
      "No credentials",
    );
  }

  if (!auth.projectId) {
    return createErrorSnapshot(
      "google-antigravity",
      "Antigravity",
      "Missing projectId",
    );
  }

  let accessToken = auth.accessToken;

  // Refresh if likely expired.
  if (
    auth.refreshToken &&
    auth.expiresAt &&
    auth.expiresAt < Date.now() + 5 * 60 * 1000
  ) {
    const refreshed = await refreshAntigravityAccessToken(auth.refreshToken);
    if (refreshed?.accessToken) accessToken = refreshed.accessToken;
  }

  const fetchModels = async (token: string): Promise<Response> => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);

    return fetch(
      "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "antigravity/1.12.4",
          "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
          Accept: "application/json",
        },
        body: JSON.stringify({ project: auth.projectId }),
        signal: controller.signal,
      },
    );
  };

  let res = await fetchModels(accessToken);

  if ((res.status === 401 || res.status === 403) && auth.refreshToken) {
    const refreshed = await refreshAntigravityAccessToken(auth.refreshToken);
    if (refreshed?.accessToken) {
      accessToken = refreshed.accessToken;
      res = await fetchModels(accessToken);
    }
  }

  if (res.status === 401 || res.status === 403) {
    return createErrorSnapshot(
      "google-antigravity",
      "Antigravity",
      "Unauthorized",
    );
  }

  if (!res.ok) {
    return createErrorSnapshot(
      "google-antigravity",
      "Antigravity",
      `HTTP ${res.status}`,
    );
  }

  const data = (await res.json()) as any;
  const models: Record<string, any> = data.models || {};

  const getQuotaInfo = (
    modelKeys: string[],
  ): { usedPercent: number; resetDescription?: string } | null => {
    for (const key of modelKeys) {
      const qi = models?.[key]?.quotaInfo;
      if (!qi) continue;
      // In practice (CodexBar issue #129), some models only provide resetTime.
      // Treat missing remainingFraction as 0% remaining (100% used), which matches Antigravity's behavior when quota is exhausted.
      const remainingFraction =
        typeof qi.remainingFraction === "number" ? qi.remainingFraction : 0;
      const usedPercent = Math.min(
        100,
        Math.max(0, (1 - remainingFraction) * 100),
      );
      const resetTime = qi.resetTime ? new Date(qi.resetTime) : undefined;
      return {
        usedPercent,
        resetDescription: resetTime ? formatReset(resetTime) : undefined,
      };
    }
    return null;
  };

  // Quota groups from the reference snippet in CodexBar issue #129.
  const windows: RateWindow[] = [];

  const claudeOrGptOss = getQuotaInfo([
    "claude-sonnet-4-5",
    "claude-sonnet-4-5-thinking",
    "claude-opus-4-5-thinking",
    "gpt-oss-120b-medium",
  ]);
  if (claudeOrGptOss) {
    windows.push({
      label: "Claude",
      usedPercent: claudeOrGptOss.usedPercent,
      resetDescription: claudeOrGptOss.resetDescription,
    });
  }

  const gemini3Pro = getQuotaInfo([
    "gemini-3-pro-high",
    "gemini-3-pro-low",
    "gemini-3-pro-preview",
  ]);
  if (gemini3Pro) {
    windows.push({
      label: "G3 Pro",
      usedPercent: gemini3Pro.usedPercent,
      resetDescription: gemini3Pro.resetDescription,
    });
  }

  const gemini3Flash = getQuotaInfo(["gemini-3-flash"]);
  if (gemini3Flash) {
    windows.push({
      label: "G3 Flash",
      usedPercent: gemini3Flash.usedPercent,
      resetDescription: gemini3Flash.resetDescription,
    });
  }

  if (windows.length === 0) {
    return createErrorSnapshot(
      "google-antigravity",
      "Antigravity",
      "No quota data",
    );
  }

  return {
    provider: "google-antigravity",
    displayName: "Antigravity",
    windows,
  };
}

// ============================================================================
// Codex (OpenAI) Usage
// ============================================================================

async function fetchCodexUsage(modelRegistry: any): Promise<UsageSnapshot> {
    // Try to get token from pi's auth storage first
    let accessToken: string | undefined;
    let accountId: string | undefined;

    try {
        // Try openai-codex provider first (pi's built-in)
        accessToken = await modelRegistry?.authStorage?.getApiKey?.("openai-codex");

        // Get account ID if available from OAuth credentials
        const cred = modelRegistry?.authStorage?.get?.("openai-codex");
        if (cred?.type === "oauth") {
            accountId = (cred as any).accountId;
        }
    } catch {}

    // Fallback to ~/.codex/auth.json if not in pi's auth
    if (!accessToken) {
        const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
        const authPath = path.join(codexHome, "auth.json");

        try {
            if (fs.existsSync(authPath)) {
                const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));

                if (data.OPENAI_API_KEY) {
                    accessToken = data.OPENAI_API_KEY;
                } else if (data.tokens?.access_token) {
                    accessToken = data.tokens.access_token;
                    accountId = data.tokens.account_id;
                }
            }
        } catch {}
    }

    if (!accessToken) {
        return { provider: "openai-codex", displayName: "Codex", windows: [], error: "No credentials" };
    }

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);

        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "CodexBar",
            Accept: "application/json",
        };

        if (accountId) {
            headers["ChatGPT-Account-Id"] = accountId;
        }

    const res = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return {
        provider: "openai-codex",
        displayName: "Codex",
        windows: [],
        error: "Token expired",
      };
    }

    if (!res.ok) {
      return {
        provider: "openai-codex",
        displayName: "Codex",
        windows: [],
        error: `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as any;
    const windows: RateWindow[] = [];

    // Primary window (usually 3-hour)
    if (data.rate_limit?.primary_window) {
      const pw = data.rate_limit.primary_window;
      const resetDate = pw.reset_at ? new Date(pw.reset_at * 1000) : undefined;
      const windowHours = Math.round((pw.limit_window_seconds || 10800) / 3600);
      windows.push({
        label: `${windowHours}h`,
        usedPercent: pw.used_percent || 0,
        resetDescription: resetDate ? formatReset(resetDate) : undefined,
      });
    }

    // Secondary window (usually daily)
    if (data.rate_limit?.secondary_window) {
      const sw = data.rate_limit.secondary_window;
      const resetDate = sw.reset_at ? new Date(sw.reset_at * 1000) : undefined;
      const windowHours = Math.round((sw.limit_window_seconds || 86400) / 3600);
      const label = windowHours >= 24 ? "Day" : `${windowHours}h`;
      windows.push({
        label,
        usedPercent: sw.used_percent || 0,
        resetDescription: resetDate ? formatReset(resetDate) : undefined,
      });
    }

        // Credits info
        let plan = data.plan_type;
        if (data.credits?.balance !== undefined && data.credits.balance !== null) {
            const balance = typeof data.credits.balance === 'number'
                ? data.credits.balance
                : parseFloat(data.credits.balance) || 0;
            plan = plan ? `${plan} (${balance.toFixed(2)})` : `${balance.toFixed(2)}`;
        }

    return { provider: "openai-codex", displayName: "Codex", windows, plan };
  } catch (e) {
    return {
      provider: "openai-codex",
      displayName: "Codex",
      windows: [],
      error: String(e),
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatReset(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return "now";

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatUsageDetails(
  resetDate: Date | undefined,
  remaining?: number,
  entitlement?: number,
): string | undefined {
  const parts: string[] = [];

  if (resetDate) {
    parts.push(formatReset(resetDate));
  }

  if (typeof remaining === "number") {
    if (typeof entitlement === "number") {
      const used = Math.max(0, entitlement - remaining);
      parts.push(`${used}/${remaining}`);
    } else {
      parts.push(`${remaining}`);
    }
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} (${parts[1]})`;
}

function getStatusEmoji(status?: ProviderStatus): string {
  if (!status) return "";
  switch (status.indicator) {
    case "none":
      return "✅";
    case "minor":
      return "⚠️";
    case "major":
      return "🟠";
    case "critical":
      return "🔴";
    case "maintenance":
      return "🔧";
    default:
      return "";
  }
}

// ============================================================================
// Common Usage Data Fetcher
// ============================================================================

async function fetchUsageData(
  modelRegistry: any,
  fetchTimeout: number = 6000,
  statusTimeout: number = 3000,
): Promise<UsageSnapshot[]> {
  const configuredProviders = getConfiguredProviders(modelRegistry);

  if (configuredProviders.length === 0) {
    return [
      {
        provider: "none",
        displayName: "No Providers",
        windows: [],
        error: "No AI providers configured with authentication",
      },
    ];
  }

  // Fetch usage and status in parallel for configured providers
  const fetchPromises = configuredProviders.map((provider) =>
    timeout(provider.fetch(), fetchTimeout, {
      provider: provider.key,
      displayName: provider.key.charAt(0).toUpperCase() + provider.key.slice(1),
      windows: [],
      error: "Timeout",
    }),
  );

  const statusPromises = configuredProviders
    .filter((provider) => provider.status)
    .map((provider) =>
      timeout(provider.status!(), statusTimeout, {
        indicator: "unknown" as const,
      }),
    );

  const [usages, statuses] = await Promise.all([
    Promise.all(fetchPromises),
    Promise.all(statusPromises),
  ]);

  // Attach status to usage where available
  let statusIndex = 0;
  for (let i = 0; i < usages.length; i++) {
    const provider = configuredProviders[i];
    if (provider.status) {
      usages[i].status = statuses[statusIndex++];
    }
  }

  // Filter out providers with no data and no error (shouldn't happen but safety check)
  return usages
    .filter((u) => u.windows.length > 0 || u.error)
    .sort((a, b) => a.provider.localeCompare(b.provider));
}

// ============================================================================
// UI Component
// ============================================================================

class UsageComponent {
  private usages: UsageSnapshot[] = [];
  private loading = true;
  private tui: { requestRender: () => void };
  private theme: any;
  private onClose: (result: unknown) => void;
  private modelRegistry: any;

  constructor(
    tui: { requestRender: () => void },
    theme: any,
    onClose: (result: unknown) => void,
    modelRegistry: any,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.onClose = onClose;
    this.modelRegistry = modelRegistry;
    this.load();
  }

  private async load() {
    this.usages = await fetchUsageData(this.modelRegistry);
    this.usages.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // If no providers have data, show a message
    if (this.usages.length === 0) {
      this.usages = [
        {
          provider: "none",
          displayName: "No Data",
          windows: [],
          error: "No usage data available for configured providers",
        },
      ];
    }

    this.loading = false;
    this.tui.requestRender();
  }

  handleInput(_data: string): void {
    this.onClose(null);
  }

  invalidate(): void {}

  render(width: number): string[] {
    const t = this.theme;
    const dim = (s: string) => t.fg("muted", s);
    const bold = (s: string) => t.bold(s);
    const accent = (s: string) => t.fg("accent", s);

    // Box dimensions: total width includes borders
    const totalW = Math.min(55, width - 4);
    const innerW = totalW - 4; // subtract "│ " and " │"
    const hLine = "─".repeat(totalW - 2); // subtract corners

    const box = (content: string) => {
      const contentW = visibleWidth(content);
      const pad = Math.max(0, innerW - contentW);
      return dim("│ ") + content + " ".repeat(pad) + dim(" │");
    };

    const lines: string[] = [];
    lines.push(dim(`╭${hLine}╮`));
    lines.push(box(bold(accent("AI Usage"))));
    lines.push(dim(`├${hLine}┤`));

    if (this.loading) {
      lines.push(box("Loading..."));
    } else {
      for (const u of this.usages) {
        // Provider header with status emoji and plan
        const statusEmoji = getStatusEmoji(u.status);
        const planStr = u.plan ? dim(` (${u.plan})`) : "";
        const statusStr = statusEmoji ? ` ${statusEmoji}` : "";
        lines.push(box(bold(u.displayName) + planStr + statusStr));

        // Show incident description if any
        if (
          u.status?.indicator &&
          u.status.indicator !== "none" &&
          u.status.indicator !== "unknown" &&
          u.status.description
        ) {
          const desc =
            u.status.description.length > 40
              ? u.status.description.substring(0, 37) + "..."
              : u.status.description;
          lines.push(box(t.fg("warning", `  ⚡ ${desc}`)));
        }

        if (u.error) {
          lines.push(box(dim(`  ${u.error}`)));
        } else if (u.windows.length === 0) {
          lines.push(box(dim("  No data")));
        } else {
          for (const w of u.windows) {
            const remaining = Math.max(0, 100 - w.usedPercent);
            const barW = 12;
            const filled = Math.round((w.usedPercent / 100) * barW);
            const empty = barW - filled;
            const color =
              remaining <= 10
                ? "error"
                : remaining <= 30
                  ? "warning"
                  : "success";
            const bar =
              t.fg(color, "█".repeat(filled)) + dim("░".repeat(empty));
            const reset = w.resetDescription
              ? dim(` ⏱${w.resetDescription}`)
              : "";
            lines.push(
              box(
                `  ${w.label.padEnd(7)} ${bar} ${remaining.toFixed(0).padStart(3)}%${reset}`,
              ),
            );
          }
        }
        lines.push(box(""));
      }
    }

    lines.push(dim(`├${hLine}┤`));
    lines.push(box(dim("Press any key to close")));
    lines.push(dim(`╰${hLine}╯`));

    return lines;
  }

  dispose(): void {}
}

// ============================================================================
// Hook & Status Bar
// ============================================================================

export default function (pi: ExtensionAPI) {
  // --- Status Bar Logic ---
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let currentCtx: any = null;
  let isEnabled = false;

  async function refresh() {
    if (!currentCtx || !isEnabled) return;

    const usages = await fetchUsageData(currentCtx.modelRegistry, 6000, 3000);

    const textObjects: { displayName: string; text: string }[] = [];

    for (const snapshot of usages) {
      let text = "";

      if (snapshot.error) {
        const isAuthError =
          snapshot.error.includes("No ") ||
          snapshot.error === "Token expired" ||
          snapshot.error === "Unauthorized";
        const isUnlimitedError =
          snapshot.error === "Unlimited" || snapshot.error === "Local";
        if (!isAuthError && !isUnlimitedError) {
          text = `${snapshot.displayName}: ⚠️`;
        }
      } else {
        // Use status indicator for color
        const statusEmoji = getStatusEmoji(snapshot.status);
        const statusIcon = statusEmoji || "✅"; // default to green check

        if (snapshot.windows.length > 0) {
          // Find the window with highest usage (most critical)
          const worstWindow = snapshot.windows.reduce((a, b) =>
            a.usedPercent > b.usedPercent ? a : b,
          );

          let usageText = "";
          if (
            typeof worstWindow.remaining === "number" &&
            typeof worstWindow.entitlement === "number"
          ) {
            const used = Math.max(
              0,
              worstWindow.entitlement - worstWindow.remaining,
            );
            usageText = `${used}/${worstWindow.entitlement}`;
          } else {
            // Fallback to percentage if no counts available
            const percent = Math.round(100 - worstWindow.usedPercent);
            usageText = `${percent}%`;
          }

          let timeText = "";
          if (worstWindow.resetsAt) {
            timeText = formatReset(worstWindow.resetsAt);
          }

          const parts = [usageText];
          if (timeText) parts.push(timeText);

          text = `${snapshot.displayName}: ${statusIcon} ${parts.join(" ")}`;
        } else {
          // Unlimited or no data
          text = `${snapshot.displayName}: ${statusIcon} ∞`;
        }
      }

      if (text) textObjects.push({ displayName: snapshot.displayName, text });
    }

    textObjects.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const fullText = textObjects.map((obj) => obj.text).join(" | ");
    currentCtx.ui.setStatus("provider-quotas", fullText);
  }

  function start(ctx: any) {
    if (isEnabled) return;
    currentCtx = ctx;
    isEnabled = true;
    refresh();
    refreshInterval = setInterval(refresh, 5 * 60 * 1000); // 5 minutes
  }

  function stop() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    if (currentCtx) {
      currentCtx.ui.setStatus("provider-quotas", undefined);
    }
    isEnabled = false;
  }

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      start(ctx);
    }
  });

  pi.on("session_shutdown", async () => {
    stop();
  });

  pi.registerCommand("usage", {
    description: "Show AI provider usage statistics",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Usage requires interactive mode", "error");
        return;
      }

      const modelRegistry = ctx.modelRegistry;
      await ctx.ui.custom((tui, theme, _kb, done) => {
        return new UsageComponent(tui, theme, done, modelRegistry);
      });
    },
  });
}
