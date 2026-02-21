/**
 * test-dependencies - List production symbols used by a test file
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerTestDependencies(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "test-dependencies",
    label: "Test Dependencies",
    description: "List production (non-test) symbols called by a test file.",
    parameters: withCommonParams({
      testFile: Type.String({ description: "Path to a test file" }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["test-deps", params.testFile];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
