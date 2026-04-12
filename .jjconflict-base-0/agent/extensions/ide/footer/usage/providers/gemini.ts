import type { BaseDependencies, ProviderConfig, RateWindow } from "../types";
import { createGenericProvider, loadTokenFromPiAuthJson } from "../util";

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
    const d = data as {
      buckets?: {
        modelId?: string;
        remainingFraction?: number;
      }[];
    };
    const quotas: Record<string, number> = {};
    for (const bucket of d.buckets || []) {
      const model = bucket.modelId || "unknown";
      const frac = bucket.remainingFraction ?? 1;
      if (!quotas[model] || frac < quotas[model]) {
        quotas[model] = frac;
      }
    }

    const { min: proMin, hasModel: hasProModel } = extractModelQuota(
      quotas,
      (m) => m.toLowerCase().includes("pro"),
    );
    const { min: flashMin, hasModel: hasFlashModel } = extractModelQuota(
      quotas,
      (m) => m.toLowerCase().includes("flash"),
    );

    const windows: RateWindow[] = [];
    if (hasProModel) {
      windows.push({ label: "Pro", usedPercent: (1 - proMin) * 100 });
    }
    if (hasFlashModel) {
      windows.push({ label: "Flash", usedPercent: (1 - flashMin) * 100 });
    }

    return windows;
  },
};

function extractModelQuota(
  quotas: Record<string, number>,
  matcher: (model: string) => boolean,
): { min: number; hasModel: boolean } {
  let min = 1;
  let hasModel = false;

  for (const [model, frac] of Object.entries(quotas)) {
    if (matcher(model)) {
      hasModel = true;
      if (frac < min) min = frac;
    }
  }

  return { min, hasModel };
}

export const fetchGeminiUsage = await createGenericProvider(geminiConfig);
