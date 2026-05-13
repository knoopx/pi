import type { Usage } from "@earendil-works/pi-ai";

export function createUsage(
  partial: Omit<Partial<Usage>, "cost"> & { cost?: Partial<Usage["cost"]> },
): Usage {
  const cost = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
    ...partial.cost,
  };
  return {
    input: partial.input ?? 0,
    output: partial.output ?? 0,
    cacheRead: partial.cacheRead ?? 0,
    cacheWrite: partial.cacheWrite ?? 0,
    totalTokens: partial.totalTokens ?? 0,
    cost,
  };
}
