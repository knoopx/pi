import defaultsConfig from "../defaults/all";
import type { GuardrailsGroup } from "../types";
import {
  loadEnabledSetting,
  saveEnabledSetting,
} from "../../../shared/config/settings";
import { isValidGroup } from "./validation";

const GUARDRAILS_SETTINGS_KEY = "guardrails";

interface GuardrailsSettings {
  enabled: boolean;
}

const DEFAULT_GUARDRAILS_SETTINGS: GuardrailsSettings = {
  enabled: true,
};

export async function loadGuardrailsSettings(): Promise<GuardrailsSettings> {
  return await loadEnabledSetting(
    GUARDRAILS_SETTINGS_KEY,
    DEFAULT_GUARDRAILS_SETTINGS,
  );
}

export async function saveGuardrailsSettings(
  updates: Partial<GuardrailsSettings>,
): Promise<GuardrailsSettings> {
  return await saveEnabledSetting(
    GUARDRAILS_SETTINGS_KEY,
    updates,
    loadGuardrailsSettings,
  );
}

class GuardrailsConfigLoader {
  private resolved: GuardrailsGroup[] | null = null;

  load(): void {
    this.resolved = defaultsConfig.filter(isValidGroup);
  }

  getConfig(): GuardrailsGroup[] {
    if (!this.resolved)
      throw new Error("Config not loaded. Call load() first.");
    return this.resolved;
  }
}

export const configLoader = new GuardrailsConfigLoader();
