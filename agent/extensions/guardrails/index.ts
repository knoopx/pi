import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { configLoader, loadGuardrailsSettings } from "./config/loader";
import { createGuardrailsHandler } from "./core/handlers";
import { setupPermissionGateHook } from "./core/gate";

export default async function (pi: ExtensionAPI) {
  configLoader.load();
  const config = configLoader.getConfig();
  const guardrailsEnabledRef = {
    value: (await loadGuardrailsSettings()).enabled,
  };

  pi.registerCommand("guardrails", {
    description:
      "Audit guardrails config, or toggle with on|off (usage: /guardrails [on|off])",
    handler: createGuardrailsHandler(guardrailsEnabledRef, config),
  });

  setupPermissionGateHook(pi, config, () => guardrailsEnabledRef.value);
}
