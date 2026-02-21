/**
 * inspect-file - Analyze one file and list all symbols it contains
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  withCommonParams,
  appendCommonFlags,
  runCm,
  FilePathParam,
  ShowBodyParam,
  FullParam,
  ExportsOnlyParam,
} from "./common.js";

export function registerInspectFile(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "inspect-file",
    label: "Inspect File",
    description: "Inspect one file and list all symbols it contains.",
    parameters: withCommonParams({
      filePath: FilePathParam,
      showBody: ShowBodyParam,
      full: FullParam,
      exportsOnly: ExportsOnlyParam,
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["inspect", params.filePath];
      if (params.showBody) args.push("--show-body");
      if (params.full) args.push("--full");
      if (params.exportsOnly) args.push("--exports-only");
      if (params.path) args.push(params.path);
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
