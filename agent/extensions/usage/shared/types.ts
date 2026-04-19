import type { Theme } from "@mariozechner/pi-coding-agent";

interface TokenStats {
  total: number;
  input: number;
  output: number;
  cache: number;
}

export interface BaseStats {
  messages: number;
  cost: number;
  tokens: TokenStats;
}

export type { Theme };
