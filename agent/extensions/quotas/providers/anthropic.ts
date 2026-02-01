import { createGenericProvider, formatRemainingDuration } from "../util";
import { ProviderConfig } from "../types";
import { RateWindow, BaseDependencies } from "../types";
import { loadTokenFromPiAuthJson } from "../util";

const loadAnthropicToken = (deps: BaseDependencies) =>
  loadTokenFromPiAuthJson(deps, "anthropic");

const anthropicConfig: ProviderConfig = {
  provider: "anthropic",
  displayName: "Anthropic (Claude)",
  tokenLoader: loadAnthropicToken,
  apiUrl: "https://api.anthropic.com/api/oauth/usage",
  headers: (token) => ({
    Authorization: `Bearer ${token}`,
    "anthropic-beta": "oauth-2025-04-20",
  }),
  customProcessor: (data) => {
    const windows = [
      {
        path: "five_hour",
        label: "5h",
        usedPercentPath: "utilization",
        resetPath: "resets_at",
      },
      {
        path: "seven_day",
        label: "Week",
        usedPercentPath: "utilization",
        resetPath: "resets_at",
      },
    ]
      .map((window) => {
        const windowData = window.path
          .split(".")
          .reduce((obj, key) => obj?.[key], data);
        if (!windowData) return null;

        const usedPercent =
          windowData.utilization || windowData.used_percent || 0;
        const resetAt = windowData.resets_at || windowData.reset_at;

        return {
          label: window.label,
          usedPercent,
          resetDescription: resetAt
            ? formatRemainingDuration(resetAt)
            : undefined,
        };
      })
      .filter(Boolean) as RateWindow[];

    // Handle extra usage which doesn't fit the generic pattern
    if (data.extra_usage?.is_enabled) {
      const extra = data.extra_usage;
      const usedCredits = extra.used_credits || 0;
      const utilization = extra.utilization || 0;
      windows.push({
        label: `Extra $${(usedCredits / 100).toFixed(2)}`,
        usedPercent: utilization,
      });
    }

    return windows;
  },
};

export const fetchAnthropicUsage = await createGenericProvider(anthropicConfig);
