import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { saveHooksSettings } from "../config/loader";
import { handleHooksAudit } from "./audit";

function createHooksHandler(ref: { value: boolean }) {
  return async function handler(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const action = args.trim().toLowerCase();

    if (action === "on") {
      ref.value = true;
      await saveHooksSettings({ enabled: true });
      ctx.ui?.notify("Hooks enabled", "info");
      return;
    }

    if (action === "off") {
      ref.value = false;
      await saveHooksSettings({ enabled: false });
      ctx.ui?.notify("Hooks disabled", "warning");
      return;
    }

    await handleHooksAudit(args, ctx);
  };
}

export function registerCommands(
  pi: ExtensionAPI,
  hooksEnabledRef: { value: boolean },
): void {
  pi.registerCommand("hooks", {
    description:
      "Audit hooks config, or toggle with on|off (usage: /hooks [on|off])",
    handler: createHooksHandler(hooksEnabledRef),
  });
}
