/**
 * find-untested - Find functions and methods not called by any tests
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerFindUntested(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "find-untested",
    label: "Find Untested",
    description: "Find functions and methods not called by any tests.",
    parameters: withCommonParams({}),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["untested"];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
