/**
 * linear-login - Save Linear API key
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { saveLinearApiKey } from "../../components/linear-issues.js";

export function registerLinearLoginCommand(pi: ExtensionAPI): void {
  pi.registerCommand("linear-login", {
    description: "Save Linear API key for /linear command",
    handler: async (args, ctx) => {
      const apiKey = args.trim();

      if (!apiKey) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            "Usage: /linear-login <api-key> (get key from Linear Settings > API)",
            "warning",
          );
        }
        return;
      }

      try {
        saveLinearApiKey(apiKey);
        if (ctx.hasUI) {
          ctx.ui.notify("Linear API key saved successfully", "info");
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) {
          ctx.ui.notify(`Failed to save API key: ${msg}`, "error");
        }
      }
    },
  });
}
