/**
 * search-symbols - Search symbols by name across the codebase
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  withCommonParams,
  appendCommonFlags,
  runCm,
  SymbolParam,
  ShowBodyParam,
  ExportsOnlyParam,
  FullParam,
  LimitParam,
} from "./common.js";

export function registerSearchSymbols(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "search-symbols",
    label: "Search Symbols",
    description:
      "Search symbols by name across the codebase. Fuzzy matching by default.",
    parameters: withCommonParams({
      symbol: SymbolParam,
      exact: Type.Optional(
        Type.Boolean({
          description: "Use exact matching instead of fuzzy (default is fuzzy)",
        }),
      ),
      showBody: ShowBodyParam,
      exportsOnly: ExportsOnlyParam,
      full: FullParam,
      context: Type.Optional(
        Type.String({
          description:
            "Context level: 'minimal' (signatures only) or 'full' (includes docstrings)",
        }),
      ),
      type: Type.Optional(
        Type.String({
          description:
            "Filter by symbol type: function, class, method, enum, static, heading, code_block",
        }),
      ),
      fast: Type.Optional(
        Type.Boolean({
          description:
            "Enable fast mode explicitly (auto-enabled for 1000+ files)",
        }),
      ),
      limit: LimitParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["query", params.symbol];
      if (params.path) args.push(params.path);
      if (params.exact) args.push("--exact");
      if (params.showBody) args.push("--show-body");
      if (params.exportsOnly) args.push("--exports-only");
      if (params.full) args.push("--full");
      if (params.context) args.push("--context", params.context);
      if (params.type) args.push("--type", params.type);
      if (params.fast) args.push("--fast");
      if (params.limit !== undefined)
        args.push("--limit", String(params.limit));
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
