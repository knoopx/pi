import { BaseDependencies, RateWindow } from "../types";
import { createGenericProvider } from "../util";
import { ProviderConfig } from "../types";
import { loadTokenFromPiAuthJson } from "../util";

function _createGeminiDeps(deps: BaseDependencies) {
  return deps;
}

const loadGeminiToken = (deps: BaseDependencies) =>
  loadTokenFromPiAuthJson(deps, "google-gemini-cli");

const geminiConfig: ProviderConfig = {
  provider: "gemini",
  displayName: "Google Gemini",
  tokenLoader: loadGeminiToken,
  apiUrl: "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
  method: "POST",
  body: "{}",
  headers: (token) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }),
  customProcessor: (data) => {
    // Aggregate quotas by model type
    const d = data as {
      buckets?: Array<{
        modelId?: string;
        remainingFraction?: number;
      }>;
    };
    const quotas: Record<string, number> = {};
    for (const bucket of d.buckets || []) {
      const model = bucket.modelId || "unknown";
      const frac = bucket.remainingFraction ?? 1;
      if (!quotas[model] || frac < quotas[model]) {
        quotas[model] = frac;
      }
    }

    const windows: RateWindow[] = [];
    let proMin = 1;
    let flashMin = 1;
    let hasProModel = false;
    let hasFlashModel = false;

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

    if (hasProModel) {
      windows.push({ label: "Pro", usedPercent: (1 - proMin) * 100 });
    }
    if (hasFlashModel) {
      windows.push({ label: "Flash", usedPercent: (1 - flashMin) * 100 });
    }

    return windows;
  },
};

export const fetchGeminiUsage = await createGenericProvider(geminiConfig);
