/**
 * find-tests - Find test functions that call a given symbol
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  withCommonParams,
  SymbolParam,
  FuzzyParam,
  executeCmTool,
} from "./common.js";

export function registerFindTests(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "find-tests",
    label: "Find Tests",
    description: "Find test functions that call a given symbol.",
    parameters: withCommonParams({
      symbol: SymbolParam,
      fuzzy: FuzzyParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return executeCmTool("tests", params, signal, ctx);
    },
  });
}
