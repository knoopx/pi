/**
 * analyze-dependencies - Analyze import relationships and symbol usage
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerAnalyzeDependencies(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "analyze-dependencies",
    label: "Analyze Dependencies",
    description:
      "Analyze import relationships and symbol usage. Use direction='used-by' to find reverse dependencies.",
    parameters: withCommonParams({
      target: Type.String({
        description: "File path (./src/auth.py) or symbol name (authenticate)",
      }),
      direction: Type.Optional(
        Type.String({
          description:
            "'imports' (what target imports) or 'used-by' (what uses target). Default: imports",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["deps", params.target];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      if (params.direction) args.push("--direction", params.direction);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
