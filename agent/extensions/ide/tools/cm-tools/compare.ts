/**
 * compare-snapshot - Compare current codebase symbols against a saved snapshot
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerCompareSnapshot(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "compare-snapshot",
    label: "Compare Snapshot",
    description:
      "Compare current codebase symbols against a saved snapshot. Shows ADDED, DELETED, MODIFIED, SIGNATURE_CHANGED.",
    parameters: withCommonParams({
      snapshot: Type.String({
        description: "Snapshot name to compare against",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["compare", params.snapshot];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
