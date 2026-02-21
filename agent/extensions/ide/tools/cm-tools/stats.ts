/**
 * project-stats - Display project statistics
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerProjectStats(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "project-stats",
    label: "Project Stats",
    description:
      "Display project statistics: file counts, symbol breakdown, and parse performance.",
    parameters: withCommonParams({}),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["stats"];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
