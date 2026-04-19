import { fetchAnthropicUsage } from "./providers/anthropic";
import { fetchCopilotUsage } from "./providers/copilot";
import { fetchGeminiUsage } from "./providers/gemini";
import { fetchOpenAIUsage } from "./providers/openai";
import { fetchZAIUsage } from "./providers/zai";
import { createDefaultDependencies } from "./runtime";
import type { BaseDependencies, UsageSnapshot } from "./types";

const defaultDependencies = createDefaultDependencies();

export async function detectAndFetchUsage(
  model: { provider?: string; id?: string } | undefined,
  dependencies: BaseDependencies = defaultDependencies,
): Promise<UsageSnapshot | undefined> {
  const provider = model?.provider?.toLowerCase() ?? "";

  if (provider.includes("zai-coding-plan"))
    return (await fetchZAIUsage(dependencies)) ?? undefined;

  if (provider.includes("anthropic"))
    return (await fetchAnthropicUsage(dependencies)) ?? undefined;

  if (provider.includes("openai"))
    return (await fetchOpenAIUsage(dependencies)) ?? undefined;

  if (provider.includes("github") || provider.includes("copilot"))
    return (await fetchCopilotUsage(dependencies)) ?? undefined;

  if (provider.includes("google") || provider.includes("gemini"))
    return (await fetchGeminiUsage(dependencies)) ?? undefined;

  return undefined;
}

export function formatUsageSnapshot(usage: UsageSnapshot | undefined): string {
  if (!usage) return "Quota: unavailable";

  if (usage.error) return `Quota: ${usage.error}`;

  if (usage.windows.length === 0) return "Quota: no data";

  return usage.windows
    .map((window) => {
      const usedPercent = Math.round(window.usedPercent);
      const reset = window.resetDescription
        ? ` (${window.resetDescription})`
        : "";
      return `${window.label}: ${usedPercent}%${reset}`;
    })
    .join(", ");
}

export type { UsageSnapshot } from "./types";
