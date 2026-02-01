import { createGenericProvider } from "../util";
import { ProviderConfig } from "../types";
import { BaseDependencies } from "../types";
import { loadTokenFromPiAuthJson } from "../util";

export function loadGithubToken(deps: BaseDependencies): string | undefined {
  return loadTokenFromPiAuthJson(
    deps,
    "github-copilot",
    (data) => data["github-copilot"]?.refresh || data["github-copilot"]?.access,
  );
}

const copilotConfig: ProviderConfig = {
  provider: "copilot",
  displayName: "GitHub Copilot",
  tokenLoader: loadGithubToken,
  apiUrl: "https://api.github.com/copilot_internal/user",
  headers: (token) => ({
    "Editor-Version": "vscode/1.96.2",
    "User-Agent": "GitHubCopilotChat/0.26.7",
    "X-Github-Api-Version": "2025-04-01",
    Accept: "application/json",
    Authorization: `token ${token}`,
  }),
  windows: [
    {
      path: "quota_snapshots.premium_interactions",
      label: "Month",
      usedPercentPath: "percent_remaining",
      usedPercentTransform: (val) => Math.max(0, 100 - (val || 0)),
      resetPath: "/quota_reset_date_utc",
    },
  ],
};

export const fetchCopilotUsage = await createGenericProvider(copilotConfig);
