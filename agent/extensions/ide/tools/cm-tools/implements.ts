/**
 * find-implementations - Find all classes/structs implementing an interface or trait
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  withCommonParams,
  appendCommonFlags,
  runCm,
  FuzzyParam,
} from "./common.js";

export function registerFindImplementations(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "find-implementations",
    label: "Find Implementations",
    description: "Find all classes/structs implementing an interface or trait.",
    parameters: withCommonParams({
      interfaceName: Type.String({ description: "Interface or trait name" }),
      fuzzy: FuzzyParam,
      traitOnly: Type.Optional(
        Type.Boolean({
          description:
            "Only show trait implementations (filter out inherent impls)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["implements", params.interfaceName];
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      if (params.fuzzy) args.push("--fuzzy");
      if (params.traitOnly) args.push("--trait-only");
      return runCm(args, signal, ctx.cwd);
    },
  });
}
