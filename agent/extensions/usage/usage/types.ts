import type { BaseStats } from "../shared/types";

interface ModelStats extends BaseStats {
  sessions: Set<string>;
}

export function emptyModelStats(): ModelStats {
  return {
    sessions: new Set(),
    messages: 0,
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, cache: 0 },
  };
}

export interface ProviderStats extends BaseStats {
  sessions: Set<string>;
  models: Map<string, ModelStats>;
}

export function emptyProviderStats(): ProviderStats {
  return {
    sessions: new Set(),
    messages: 0,
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, cache: 0 },
    models: new Map(),
  };
}

interface TotalStats extends BaseStats {
  sessions: number;
}

export function emptyTimeFilteredStats(): {
  providers: Map<string, ProviderStats>;
  totals: TotalStats;
} {
  return {
    providers: new Map(),
    totals: {
      sessions: 0,
      messages: 0,
      cost: 0,
      tokens: { total: 0, input: 0, output: 0, cache: 0 },
    },
  };
}

interface TimeFilteredStats {
  providers: Map<string, ProviderStats>;
  totals: TotalStats;
}

export function accumulateStats(
  target: BaseStats,
  cost: number,
  tokens: { total: number; input: number; output: number; cache: number },
): void {
  target.messages++;
  target.cost += cost;
  target.tokens.total += tokens.total;
  target.tokens.input += tokens.input;
  target.tokens.output += tokens.output;
  target.tokens.cache += tokens.cache;
}

export interface UsageData {
  today: TimeFilteredStats;
  thisWeek: TimeFilteredStats;
  allTime: TimeFilteredStats;
}

export type TabName = "today" | "thisWeek" | "allTime";
