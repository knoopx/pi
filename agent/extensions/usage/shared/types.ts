import type { Theme } from "@mariozechner/pi-coding-agent";

interface TokenStats {
  total: number;
  input: number;
  output: number;
  cache: number;
}

function emptyTokens(): TokenStats {
  return { total: 0, input: 0, output: 0, cache: 0 };
}

export interface BaseStats {
  messages: number;
  cost: number;
  tokens: TokenStats;
}

export type { Theme };
