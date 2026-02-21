/**
 * trace-call-path - Find the shortest call path from one symbol to another
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { withCommonParams, FuzzyParam, executeCmTool } from "./common.js";

export function registerTraceCallPath(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "trace-call-path",
    label: "Trace Call Path",
    description:
      "Find the shortest call path from one symbol to another using BFS.",
    parameters: withCommonParams({
      fromSymbol: Type.String({ description: "Start symbol" }),
      toSymbol: Type.String({ description: "Destination symbol" }),
      fuzzy: FuzzyParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return executeCmTool("trace", params, signal, ctx);
    },
  });
}
