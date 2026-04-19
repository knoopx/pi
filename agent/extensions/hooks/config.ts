import defaultsConfig from "./defaults";
import { type HooksConfig, isValidConfig } from "./schema";
import { loadEnabledSetting, saveEnabledSetting } from "../../shared/settings";

const HOOKS_SETTINGS_KEY = "hooks";

interface HooksSettings {
  enabled: boolean;
}

const DEFAULT_HOOKS_SETTINGS: HooksSettings = {
  enabled: true,
};

export async function loadHooksSettings(): Promise<HooksSettings> {
  return await loadEnabledSetting(HOOKS_SETTINGS_KEY, DEFAULT_HOOKS_SETTINGS);
}

export async function saveHooksSettings(
  updates: Partial<HooksSettings>,
): Promise<HooksSettings> {
  return await saveEnabledSetting(
    HOOKS_SETTINGS_KEY,
    updates,
    loadHooksSettings,
  );
}

class ConfigLoader {
  private resolved: HooksConfig | null = null;

  load(): void {
    this.resolved = isValidConfig(defaultsConfig) ? defaultsConfig : [];
  }

  getConfig(): HooksConfig {
    if (!this.resolved)
      throw new Error("Config not loaded. Call load() first.");
    return this.resolved;
  }
}

export const configLoader = new ConfigLoader();
