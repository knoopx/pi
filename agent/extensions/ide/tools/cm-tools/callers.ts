/**
 * find-callers - Find all callers of a function/method symbol
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  withCommonParams,
  SymbolParam,
  FuzzyParam,
  LimitParam,
  executeCmTool,
} from "./common.js";

export function registerFindCallers(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "find-callers",
    label: "Find Callers",
    description:
      "Find all callers of a function/method symbol. Use qualified names (e.g. Foo::new) to reduce noise.",
    parameters: withCommonParams({
      symbol: SymbolParam,
      fuzzy: FuzzyParam,
      limit: LimitParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return executeCmTool("callers", params, signal, ctx);
    },
  });
}
