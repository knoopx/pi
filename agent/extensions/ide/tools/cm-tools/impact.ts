/**
 * impact-analysis - Quick breakage report for a symbol
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  withCommonParams,
  appendCommonFlags,
  runCm,
  SymbolParam,
  LimitParam,
} from "./common.js";

export function registerImpactAnalysis(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "impact-analysis",
    label: "Impact Analysis",
    description:
      "Quick breakage report for a symbol: definition + callers + tests. Run after editing a function.",
    parameters: withCommonParams({
      symbol: SymbolParam,
      exact: Type.Optional(
        Type.Boolean({ description: "Use exact matching (default is fuzzy)" }),
      ),
      includeDocs: Type.Optional(
        Type.Boolean({
          description: "Include markdown headings/code blocks as candidates",
        }),
      ),
      limit: LimitParam,
      all: Type.Optional(
        Type.Boolean({ description: "Show full lists (ignores --limit)" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["impact", params.symbol];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      if (params.exact) args.push("--exact");
      if (params.includeDocs) args.push("--include-docs");
      if (params.limit !== undefined)
        args.push("--limit", String(params.limit));
      if (params.all) args.push("--all");
      return runCm(args, signal, ctx.cwd);
    },
  });
}
