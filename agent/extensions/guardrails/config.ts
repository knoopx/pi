import defaultsConfig from "./defaults";
import type { GuardrailsGroup, GuardrailsRule } from "./types";
import {
  loadEnabledSetting,
  saveEnabledSetting,
} from "../../shared/config/settings";
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
function isValidGroup(group: unknown): group is GuardrailsGroup {
  const g = group as Record<string, unknown>;
  return (
    typeof group === "object" &&
    group !== null &&
    typeof g.group === "string" &&
    typeof g.pattern === "string" &&
    (g.excludePattern === undefined || typeof g.excludePattern === "string") &&
    Array.isArray(g.rules) &&
    g.rules.every((rule: unknown) => isValidRule(rule))
  );
}
function isValidRule(rule: unknown): boolean {
  const r = rule as Record<string, unknown>;
  if (typeof rule !== "object" || rule === null) return false;
  if (!isStringField(r, "pattern")) return false;
  if (!isOptionalStringField(r, "file_pattern")) return false;
  if (!isOptionalStringField(r, "includes")) return false;
  if (!isOptionalStringField(r, "excludes")) return false;
  if (!isValidScope(r.scope)) return false;
  if (!isValidAction(r.action)) return false;
  return typeof r.reason === "string";
}
function isStringField(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === "string";
}
function isOptionalStringField(
  obj: Record<string, unknown>,
  key: string,
): boolean {
  const val = obj[key];
  return val === undefined || typeof val === "string";
}
function isValidScope(scope: unknown): boolean {
  if (scope === undefined) return true;
  return scope === "project" || scope === "external";
}
function isValidAction(action: unknown): boolean {
  return action === "block" || action === "confirm";
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
