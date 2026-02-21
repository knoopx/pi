/**
 * symbol-diff - Show symbol-level changes between current code and a git commit
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  withCommonParams,
  appendCommonFlags,
  runCm,
  FullParam,
} from "./common.js";

export function registerSymbolDiff(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "symbol-diff",
    label: "Symbol Diff",
    description:
      "Show symbol-level changes between current code and a git commit.",
    parameters: withCommonParams({
      commit: Type.String({
        description: "Git ref to compare against (e.g. main, HEAD~1, v1.0)",
      }),
      full: FullParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["diff", params.commit];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      if (params.full) args.push("--full");
      return runCm(args, signal, ctx.cwd);
    },
  });
}
