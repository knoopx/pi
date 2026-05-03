import {
  readSettingsOrEmpty,
  loadExtensionConfig,
} from "../../shared/config/settings";

export interface Config extends Record<string, unknown> {
  enabled: boolean;
  serverUrl: string;
  embeddingModel: string;
  scoreThreshold: number;
  maxSkills: number;
  chunkMaxChars: number;
  promptScoreThreshold: number;
}

const DEFAULTS: Config = {
  enabled: true,
  serverUrl: "http://localhost:11434/v1/embeddings",
  embeddingModel: "unsloth/embeddinggemma-300m-GGUF",
  maxSkills: 4,
  chunkMaxChars: 1000,
  scoreThreshold: 0.55,
  promptScoreThreshold: 0.6,
};

const SETTINGS_KEY = "skillReminder";

export async function loadConfig(): Promise<Config> {
  const settings = await readSettingsOrEmpty();
  return loadExtensionConfig(settings, SETTINGS_KEY, DEFAULTS);
}
