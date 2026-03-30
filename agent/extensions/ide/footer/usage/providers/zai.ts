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
  customProcessor: (rawData) => {
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

    if (!limits || limits.length === 0) {
      return [];
    }

    const windows: RateWindow[] = [];

    for (const limit of limits) {
      let label: string;
      const usedPercent: number = limit.percentage;
      let resetDescription: string | undefined;

      // Use API-provided nextResetTime if available, otherwise calculate
      if (limit.nextResetTime) {
        // API returns milliseconds, formatRemainingDuration expects seconds for numbers
        resetDescription = formatRemainingDuration(limit.nextResetTime / 1000);
      }

      if (limit.type === "TOKENS_LIMIT") {
        label = "5h";
        if (!resetDescription) {
          // Fallback: Calculate next 5-hour block
          const now = new Date();
          const nextReset = new Date(now);
          nextReset.setHours(now.getHours() + 1, 0, 0, 0);
          const hour = nextReset.getHours();
          const next5hHour = Math.ceil(hour / 5) * 5;
          if (next5hHour >= 24) {
            nextReset.setHours(0, 0, 0, 0);
            nextReset.setDate(nextReset.getDate() + 1);
          } else {
            nextReset.setHours(next5hHour, 0, 0, 0);
          }
          // Convert ms to seconds for formatRemainingDuration
          resetDescription = formatRemainingDuration(
            nextReset.getTime() / 1000,
          );
        }
      } else {
        continue; // Skip all other limit types
      }

      windows.push({
        label,
        usedPercent,
        resetDescription,
      });
    }

    return windows;
  },
};

export const fetchZAIUsage = await createGenericProvider(zaiConfig);
