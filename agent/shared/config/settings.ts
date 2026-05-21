import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const SETTINGS_PATH = resolve(homedir(), ".pi/agent/settings.json");

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function isValidSettingsObject(
  parsed: unknown,
): parsed is Record<string, unknown> {
  return (
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
  );
}

async function _readSettingsSafe(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (!isValidSettingsObject(parsed)) {
      throw new Error("settings.json must contain a JSON object");
    }
    return parsed;
  } catch (error) {
    if (isMissingFileError(error)) return {};
    throw new Error(
      "Unable to read settings.json safely; refusing to overwrite existing configuration.",
      { cause: error },
    );
  }
}

function extractEnabled(raw: unknown, defaultEnabled: boolean): boolean {
  if (typeof raw !== "object" || raw === null) return defaultEnabled;
  const record = raw as Record<string, unknown>;
  return typeof record.enabled === "boolean" ? record.enabled : defaultEnabled;
}

export async function loadEnabledSetting<T extends { enabled: boolean }>(
  key: string,
  defaults: T,
): Promise<T> {
  const settings = await _readSettingsSafe();
  const raw = settings[key];
  if (raw === undefined || Array.isArray(raw)) return { ...defaults };
  validateSettingsObject(key, raw);
  return {
    ...defaults,
    enabled: extractEnabled(raw, defaults.enabled),
  };
}

function validateSettingsObject(key: string, raw: unknown): void {
  if (typeof raw === "object" && raw !== null) return;
  throw new Error(`Invalid ${key} settings format in settings.json`);
}

export async function saveEnabledSetting<T extends { enabled: boolean }>(
  key: string,
  updates: Partial<T>,
  loadFn: () => Promise<T>,
): Promise<T> {
  const existingSettings = await _readSettingsSafe();
  const current = await loadFn();
  const next: T = {
    ...current,
    ...updates,
  };
  const currentValue = existingSettings[key];
  const record =
    typeof currentValue === "object" &&
    currentValue !== null &&
    !Array.isArray(currentValue)
      ? (currentValue as Record<string, unknown>)
      : {};

  existingSettings[key] = {
    ...record,
    enabled: next.enabled,
  };

  await writeFile(
    SETTINGS_PATH,
    `${JSON.stringify(existingSettings, null, 2)}\n`,
    "utf-8",
  );

  return next;
}
