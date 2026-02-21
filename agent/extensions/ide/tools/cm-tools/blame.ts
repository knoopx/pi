/**
 * symbol-blame - Show who last modified a symbol and when
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  withCommonParams,
  appendCommonFlags,
  runCm,
  SymbolParam,
  FilePathParam,
} from "./common.js";

export function registerSymbolBlame(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "symbol-blame",
    label: "Symbol Blame",
    description: "Show who last modified a symbol and when.",
    parameters: withCommonParams({
      symbol: SymbolParam,
      filePath: FilePathParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["blame", params.symbol, params.filePath];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
