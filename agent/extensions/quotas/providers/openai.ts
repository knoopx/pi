import { createGenericProvider } from "../util";
import { ProviderConfig } from "../types";
import { BaseDependencies } from "../types";
import { loadTokenFromPiAuthJson } from "../util";

const loadOpenAIToken = (deps: BaseDependencies) =>
  loadTokenFromPiAuthJson(deps, "openai-codex");

const openaiConfig: ProviderConfig = {
  provider: "openai",
  displayName: "OpenAI",
  tokenLoader: loadOpenAIToken,
  apiUrl: "https://chatgpt.com/backend-api/wham/usage",
  headers: (token) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }),
  windows: [
    {
      path: "rate_limit.primary_window",
      label: (_data, windowData) => {
        const wd = windowData as { limit_window_seconds?: number };
        const hours = Math.round((wd.limit_window_seconds || 10800) / 3600);
        return `${hours}h`;
      },
      usedPercentPath: "used_percent",
      resetPath: "reset_at",
    },
    {
      path: "rate_limit.secondary_window",
      label: (_data, windowData) => {
        const wd = windowData as { limit_window_seconds?: number };
        const hours = Math.round((wd.limit_window_seconds || 86400) / 3600);
        return hours >= 144 ? "Week" : hours >= 24 ? "Day" : `${hours}h`;
      },
      usedPercentPath: "used_percent",
      resetPath: "reset_at",
    },
  ],
};

export const fetchOpenAIUsage = await createGenericProvider(openaiConfig);
