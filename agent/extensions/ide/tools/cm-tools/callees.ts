/**
 * find-callees - Find all functions/methods called by a symbol
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  withCommonParams,
  SymbolParam,
  FuzzyParam,
  LimitParam,
  executeCmTool,
} from "./common.js";

export function registerFindCallees(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "find-callees",
    label: "Find Callees",
    description: "Find all functions/methods called by a symbol.",
    parameters: withCommonParams({
      symbol: SymbolParam,
      fuzzy: FuzzyParam,
      limit: LimitParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return executeCmTool("callees", params, signal, ctx);
    },
  });
}
