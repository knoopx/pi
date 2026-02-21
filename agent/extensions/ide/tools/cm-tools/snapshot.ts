/**
 * save-snapshot - Save a named codebase snapshot for future comparison
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { withCommonParams, appendCommonFlags, runCm } from "./common.js";

export function registerSaveSnapshot(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "save-snapshot",
    label: "Save Snapshot",
    description:
      "Save a named codebase snapshot for future comparison, or list/delete snapshots.",
    parameters: withCommonParams({
      name: Type.Optional(
        Type.String({ description: "Snapshot name (required unless --list)" }),
      ),
      list: Type.Optional(
        Type.Boolean({ description: "List all saved snapshots" }),
      ),
      delete: Type.Optional(
        Type.String({ description: "Delete a snapshot by name" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["snapshot"];
      if (params.list) {
        args.push("--list");
      } else if (params.delete) {
        args.push("--delete", params.delete);
      } else if (params.name) {
        args.push(params.name);
        if (params.path) args.push(params.path);
      }
      appendCommonFlags(args, params);
      return runCm(args, signal, ctx.cwd);
    },
  });
}
