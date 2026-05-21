import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { GuardrailsGroup } from "../types";

export function createGuardrailsHandler(
  ref: { value: boolean },
  _config: GuardrailsGroup[],
) {
  return async function handler(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const action = args.trim().toLowerCase();

    if (action === "on") {
      ref.value = true;
      const { saveGuardrailsSettings } = await import("../config/loader");
      await saveGuardrailsSettings({ enabled: true });
      ctx.ui?.notify("Guardrails enabled", "info");
      return;
    }

    if (action === "off") {
      ref.value = false;
      const { saveGuardrailsSettings } = await import("../config/loader");
      await saveGuardrailsSettings({ enabled: false });
      ctx.ui?.notify("Guardrails disabled", "warning");
      return;
    }
  };
}
