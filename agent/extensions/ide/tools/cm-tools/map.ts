/**
 * project-map - Generate a project map showing files and symbols
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerProjectMap(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "project-map",
    label: "Project Map",
    description:
      "Generate a project map showing files and symbols at different detail levels.",
    parameters: withCommonParams({
      level: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 3,
          description:
            "Detail level: 1=overview, 2=files with counts, 3=full symbols",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["map"];
      if (params.path) args.push(params.path);
      if (params.level !== undefined)
        args.push("--level", String(params.level));
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
