import { readSettingsOrEmpty, loadExtensionConfig } from "../../shared/config/settings";

export interface PathSuggesterConfig {
  enabled: boolean;
  serverUrl: string;
  embeddingModel: string;
  scoreThreshold: number;
  maxSuggestions: number;
  promptScoreThreshold: number;
}

const DEFAULTS: PathSuggesterConfig = {
  enabled: true,
  serverUrl: "http://localhost:11434/v1/embeddings",
  embeddingModel: "unsloth/embeddinggemma-300m-GGUF",
  maxSuggestions: 5,
  scoreThreshold: 0.55,
  promptScoreThreshold: 0.55,
};

const SETTINGS_KEY = "pathSuggester";

export async function loadConfig(): Promise<PathSuggesterConfig> {
  const settings = await readSettingsOrEmpty();
  return loadExtensionConfig(
    settings,
    SETTINGS_KEY,
    DEFAULTS as unknown as Record<string, unknown>,
  );
}
