import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const SETTINGS_PATH = resolve(homedir(), ".pi/agent/settings.json");

async function readSettingsOrEmpty(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface SkillReminderConfig {
  enabled: boolean;
  serverUrl: string;
  embeddingModel: string;
  scoreThreshold: number;
  maxSkills: number;
  chunkMaxChars: number;
  promptScoreThreshold: number;
}

const DEFAULTS: SkillReminderConfig = {
  enabled: true,
  serverUrl: "http://localhost:11434/v1/embeddings",
  embeddingModel: "unsloth/embeddinggemma-300m-GGUF",
  maxSkills: 4,
  chunkMaxChars: 1000,
  scoreThreshold: 0.8,
  promptScoreThreshold: 0.8,
};

const SETTINGS_KEY = "skillReminder";

function isValidRaw(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && !Array.isArray(raw) && raw !== null;
}

function coerceBool(key: string, r: Record<string, unknown>, def: boolean) {
  return typeof r[key] === "boolean" ? r[key] : def;
}

function coerceStr(key: string, r: Record<string, unknown>, def: string) {
  return typeof r[key] === "string" ? r[key] : def;
}

function coerceNum(key: string, r: Record<string, unknown>, def: number) {
  return typeof r[key] === "number" ? r[key] : def;
}

export async function loadConfig(): Promise<SkillReminderConfig> {
  const settings = await readSettingsOrEmpty();
  const raw = settings[SETTINGS_KEY];

  if (!isValidRaw(raw)) return DEFAULTS;

  return {
    enabled: coerceBool("enabled", raw, DEFAULTS.enabled),
    serverUrl: coerceStr("serverUrl", raw, DEFAULTS.serverUrl),
    embeddingModel: coerceStr("embeddingModel", raw, DEFAULTS.embeddingModel),
    scoreThreshold: coerceNum("scoreThreshold", raw, DEFAULTS.scoreThreshold),
    maxSkills: coerceNum("maxSkills", raw, DEFAULTS.maxSkills),
    chunkMaxChars: coerceNum("chunkMaxChars", raw, DEFAULTS.chunkMaxChars),
    promptScoreThreshold: coerceNum(
      "promptScoreThreshold",
      raw,
      DEFAULTS.promptScoreThreshold,
    ),
  };
}
