/**
 * symbol-history - Show git evolution history for a symbol
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  withCommonParams,
  appendCommonFlags,
  runCm,
  SymbolParam,
  FilePathParam,
} from "./common.js";

export function registerSymbolHistory(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "symbol-history",
    label: "Symbol History",
    description: "Show the evolution of a symbol across git history.",
    parameters: withCommonParams({
      symbol: SymbolParam,
      filePath: FilePathParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["history", params.symbol, params.filePath];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
