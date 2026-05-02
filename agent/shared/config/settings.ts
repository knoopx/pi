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

export async function readSettingsOrEmpty(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readSettingsSafe(): Promise<Record<string, unknown>> {
  return _readSettingsSafe();
}

async function _readSettingsSafe(): Promise<Record<string, unknown>> {
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

export async function loadEnabledSetting<T extends { enabled: boolean }>(
  key: string,
  defaults: T,
): Promise<T> {
  const settings = await _readSettingsSafe();
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

// --- Extension config helpers (from settings-core.ts) ---

export function loadExtensionConfig<T>(
  settings: Record<string, unknown>,
  key: string,
  defaults: Record<string, unknown>,
): T {
  const raw = settings[key];
  if (!isValidRaw(raw)) return defaults as T;

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(defaults)) {
    if (typeof v === "boolean") {
      result[k] = coerceBool(k, raw, v);
    } else if (typeof v === "string") {
      result[k] = coerceStr(k, raw, v);
    } else if (typeof v === "number") {
      result[k] = coerceNum(k, raw, v);
    }
  }
  return result as T;
}

function isValidRaw(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && !Array.isArray(raw) && raw !== null;
}

function coerceBool(
  key: string,
  r: Record<string, unknown>,
  def: boolean,
): boolean {
  return typeof r[key] === "boolean" ? r[key] : def;
}

function coerceStr(
  key: string,
  r: Record<string, unknown>,
  def: string,
): string {
  return typeof r[key] === "string" ? r[key] : def;
}

function coerceNum(
  key: string,
  r: Record<string, unknown>,
  def: number,
): number {
  return typeof r[key] === "number" ? r[key] : def;
}
