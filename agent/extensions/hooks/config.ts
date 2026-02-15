import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { type HooksConfig, isValidConfig } from "./schema";

const GLOBAL_CONFIG_PATH = resolve(homedir(), ".pi/agent/settings.json");
const EXTENSION_CONFIG_PATH = resolve(
  import.meta.dirname || __dirname,
  "defaults.json",
);
const PROJECT_CONFIG_FILE = ".pi/hooks.json";

class ConfigLoader {
  private defaultsConfig: HooksConfig | null = null;
  private globalConfig: HooksConfig | null = null;
  private resolved: HooksConfig | null = null;
  private configVersion = 0;
  private projectConfigCache = new Map<string, HooksConfig | null>();

  async load(): Promise<void> {
    this.defaultsConfig = await this.loadDefaultsFile();
    this.globalConfig = await this.loadGlobalFile();
    this.projectConfigCache.clear();
    this.resolved = this.mergeConfigs();
    this.configVersion++;
  }

  private async loadDefaultsFile(): Promise<HooksConfig | null> {
    try {
      const content = await readFile(EXTENSION_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      return isValidConfig(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async loadGlobalFile(): Promise<HooksConfig | null> {
    try {
      const content = await readFile(GLOBAL_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      const hooks = parsed.hooks;
      return isValidConfig(hooks) ? hooks : null;
    } catch {
      return null;
    }
  }

  private async loadProjectFile(cwd: string): Promise<HooksConfig | null> {
    try {
      const projectConfigPath = resolve(cwd, PROJECT_CONFIG_FILE);
      const content = await readFile(projectConfigPath, "utf-8");
      const parsed = JSON.parse(content);
      return isValidConfig(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private mergeConfigs(projectConfig?: HooksConfig | null): HooksConfig {
    // Global config completely overrides defaults (existing behavior)
    if (this.globalConfig) return this.globalConfig;

    // Project config extends defaults
    if (projectConfig && this.defaultsConfig) {
      return this.mergeGroupConfigs(this.defaultsConfig, projectConfig);
    }

    return projectConfig ?? this.defaultsConfig ?? [];
  }

  private mergeGroupConfigs(
    base: HooksConfig,
    override: HooksConfig,
  ): HooksConfig {
    const result = [...base];
    const groupMap = new Map(result.map((g, i) => [g.group, i]));

    for (const overrideGroup of override) {
      const existingIndex = groupMap.get(overrideGroup.group);
      if (existingIndex !== undefined) {
        // Merge hooks into existing group
        result[existingIndex] = {
          ...result[existingIndex],
          hooks: [...result[existingIndex].hooks, ...overrideGroup.hooks],
        };
      } else {
        // Add new group
        result.push(overrideGroup);
      }
    }

    return result;
  }

  getConfig(): HooksConfig {
    if (!this.resolved) {
      throw new Error("Config not loaded. Call load() first.");
    }
    return this.resolved;
  }

  async getConfigForProject(cwd: string): Promise<HooksConfig> {
    if (!this.projectConfigCache.has(cwd)) {
      const projectConfig = await this.loadProjectFile(cwd);
      this.projectConfigCache.set(cwd, projectConfig);
    }
    const projectConfig = this.projectConfigCache.get(cwd);
    return this.mergeConfigs(projectConfig);
  }

  getVersion(): number {
    return this.configVersion;
  }

  async saveGlobal(config: HooksConfig): Promise<void> {
    await mkdir(dirname(GLOBAL_CONFIG_PATH), { recursive: true });

    let existingSettings: Record<string, unknown> = {};
    try {
      const content = await readFile(GLOBAL_CONFIG_PATH, "utf-8");
      existingSettings = JSON.parse(content);
    } catch {
      // File doesn't exist or invalid JSON
    }

    existingSettings.hooks = config;
    await writeFile(
      GLOBAL_CONFIG_PATH,
      `${JSON.stringify(existingSettings, null, 2)}\n`,
      "utf-8",
    );
    await this.load();
  }

  hasGlobalConfig(): boolean {
    return this.globalConfig !== null;
  }

  hasDefaultsConfig(): boolean {
    return this.defaultsConfig !== null;
  }

  getGlobalConfig(): HooksConfig {
    return this.globalConfig ?? [];
  }

  getDefaultsConfig(): HooksConfig {
    return this.defaultsConfig ?? [];
  }
}

export const configLoader = new ConfigLoader();
