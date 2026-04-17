import type { ProviderConfig, RateWindow } from "../types";
import {
  createGenericProvider,
  formatRemainingDuration,
  loadTokenFromPiAuthJson,
} from "../util";

const zaiConfig: ProviderConfig = {
  provider: "zai",
  displayName: "Z.AI (GLM Coding Plan)",
  tokenLoader: (deps) =>
    loadTokenFromPiAuthJson(deps, "z-ai", (d) => d.key as string | undefined),
  apiUrl: "https://api.z.ai/api/monitor/usage/quota/limit",
  headers: (token) => ({
    Authorization: token,
  }),
  customProcessor(rawData) {
    interface LimitItem {
      type: string;
      percentage: number;
      current_value?: number;
      usage?: number;
      usage_details?: string;
      nextResetTime?: number;
    }

    interface DataType {
      data?: {
        limits?: LimitItem[];
      };
    }

    const response = rawData as DataType;
    const limits = response.data?.limits;

    if (!limits || limits.length === 0) return [];

    const windows: RateWindow[] = [];

    for (const limit of limits) {
      if (limit.type !== "TOKENS_LIMIT") continue;

      const usedPercent: number = limit.percentage;
      const resetDescription = calculateResetDescription(limit.nextResetTime);

      windows.push({
        label: "5h",
        usedPercent,
        resetDescription,
      });
    }

    return windows;
  },
};

function calculateResetDescription(
  nextResetTime: number | undefined,
): string | undefined {
  if (!nextResetTime) throw new Error("Z.AI API did not provide nextResetTime");

  return formatRemainingDuration(nextResetTime / 1000);
}

export const fetchZAIUsage = await createGenericProvider(zaiConfig);
