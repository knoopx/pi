/**
 * show-schema - Display the field schema for a data structure symbol
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  withCommonParams,
  SymbolParam,
  FuzzyParam,
  executeCmTool,
} from "./common.js";

export function registerShowSchema(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "show-schema",
    label: "Show Schema",
    description:
      "Display field schema for data structures (structs, classes, dataclasses, interfaces).",
    parameters: withCommonParams({
      symbol: SymbolParam,
      fuzzy: FuzzyParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return executeCmTool("schema", params, signal, ctx);
    },
  });
}
