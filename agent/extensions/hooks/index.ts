import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { configLoader, loadHooksSettings } from "./config/loader";
import type { HooksConfig } from "./types/schema";
import { registerEventHandlers } from "./engine/events";
import { registerCommands } from "./commands/register";

export default async function hooksExtension(pi: ExtensionAPI): Promise<void> {
  const getConfig = (): Promise<HooksConfig> => {
    configLoader.load();
    return Promise.resolve(configLoader.getConfig());
  };
  const hooksEnabledRef = {
    value: (await loadHooksSettings()).enabled,
  };

  registerEventHandlers(pi, getConfig, () => hooksEnabledRef.value);
  registerCommands(pi, hooksEnabledRef);
}
