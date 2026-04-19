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

async function readSettingsOrEmpty(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("settings.json must contain a JSON object");
    return parsed;
  } catch (error) {
    if (isMissingFileError(error)) return {};
    throw new Error(
      "Unable to read settings.json safely; refusing to overwrite existing configuration.",
      { cause: error },
    );
  }
}

/**
 * Load a boolean-enabled setting from settings.json under the given key.
 */
export async function loadEnabledSetting<T extends { enabled: boolean }>(
  key: string,
  defaults: T,
): Promise<T> {
  const settings = await readSettingsOrEmpty();
  const raw = settings[key];

  if (raw === undefined || Array.isArray(raw)) {
    return { ...defaults };
  }

  if (typeof raw !== "object" || raw === null)
    throw new Error(`Invalid ${key} settings format in settings.json`);

  const rawRecord = raw as Record<string, unknown>;

  return {
    ...defaults,
    enabled:
      typeof rawRecord.enabled === "boolean"
        ? rawRecord.enabled
        : defaults.enabled,
  };
}

/**
 * Save a boolean-enabled setting to settings.json under the given key.
 */
export async function saveEnabledSetting<T extends { enabled: boolean }>(
  key: string,
  updates: Partial<T>,
  loadFn: () => Promise<T>,
): Promise<T> {
  const existingSettings = await readSettingsOrEmpty();
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
