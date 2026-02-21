/**
 * api-changes - Show API changes since a git commit
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerApiChanges(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "api-changes",
    label: "API Changes",
    description:
      "Show API changes since a git commit. Use --breaking to show only breaking changes.",
    parameters: withCommonParams({
      commit: Type.String({
        description: "Git ref baseline (e.g. main, v1.0, HEAD~1)",
      }),
      breaking: Type.Optional(
        Type.Boolean({
          description:
            "Only show breaking changes (deleted symbols, signature changes)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["since", params.commit];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      if (params.breaking) args.push("--breaking");
      return runCm(args, signal, ctx.cwd);
    },
  });
}
