/**
 * analyze-types - Analyze parameter and return types for a symbol
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  withCommonParams,
  SymbolParam,
  FuzzyParam,
  executeCmTool,
} from "./common.js";

export function registerAnalyzeTypes(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "analyze-types",
    label: "Analyze Types",
    description:
      "Analyze parameter and return types for a symbol and locate their definitions.",
    parameters: withCommonParams({
      symbol: SymbolParam,
      fuzzy: FuzzyParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return executeCmTool("types", params, signal, ctx);
    },
  });
}
