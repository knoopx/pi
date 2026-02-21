/**
 * find-entrypoints - Find exported symbols with no internal callers
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerFindEntrypoints(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "find-entrypoints",
    label: "Find Entrypoints",
    description:
      "Find exported symbols with no internal callers. Useful for finding public API surface or dead code.",
    parameters: withCommonParams({}),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["entrypoints"];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
