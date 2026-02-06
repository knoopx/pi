import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

/**
 * Configuration schema for the guardrails extension.
 *
 * GuardrailsConfig is the user-facing schema (all fields optional).
 * ResolvedConfig is the internal schema (all fields required, defaults applied).
 */

export interface GuardrailsRule {
  context: "command" | "file_name" | "file_content";
  pattern: string;
  /**
   * Optional pattern that must also match for the rule to apply.
   */
  includes?: string;
  /**
   * Optional pattern that exempts the rule from applying.
   * If this pattern matches, the rule is skipped (even if `pattern` matches).
   */
  excludes?: string;
  action: "block" | "confirm";
  reason: string;
}

export interface GuardrailsGroup {
  group: string;
  /**
   * File glob patterns to activate this group.
   * The group is activated if any matching file exists in the project root.
   */
  pattern: string;
  rules: GuardrailsRule[];
}

export type GuardrailsConfig = GuardrailsGroup[];

export type ResolvedConfig = GuardrailsGroup[];

const GLOBAL_CONFIG_PATH = resolve(homedir(), ".pi/agent/settings.json");
const EXTENSION_CONFIG_PATH = resolve(
  import.meta.dirname || __dirname,
  "defaults.json",
);

class ConfigLoader {
  private defaultsConfig: GuardrailsConfig | null = null;
  private globalConfig: GuardrailsConfig | null = null;
  private resolved: ResolvedConfig | null = null;

  async load(): Promise<void> {
    this.defaultsConfig = await this.loadDefaultsFile();
    this.globalConfig = await this.loadGlobalFile();
    this.resolved = this.mergeConfigs();
  }

  private async loadDefaultsFile(): Promise<GuardrailsConfig | null> {
    try {
      const content = await readFile(EXTENSION_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? (parsed as GuardrailsConfig) : null;
    } catch {
      return null;
    }
  }

  private async loadGlobalFile(): Promise<GuardrailsConfig | null> {
    try {
      const content = await readFile(GLOBAL_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      const guardrails = parsed.guardrails;
      return Array.isArray(guardrails)
        ? (guardrails as GuardrailsConfig)
        : null;
    } catch {
      return null;
    }
  }

  private mergeConfigs(): ResolvedConfig {
    // Use global config if it exists, otherwise use defaults
    const config = this.globalConfig ?? this.defaultsConfig ?? [];
    return config.filter(this.isValidGroup);
  }

  private isValidGroup(group: unknown): group is GuardrailsGroup {
    const g = group as Record<string, unknown>;
    return (
      typeof group === "object" &&
      group !== null &&
      typeof g.group === "string" &&
      typeof g.pattern === "string" &&
      Array.isArray(g.rules) &&
      g.rules.every((rule: unknown) => {
        const r = rule as Record<string, unknown>;
        return (
          typeof rule === "object" &&
          rule !== null &&
          typeof r.pattern === "string" &&
          (r.includes === undefined || typeof r.includes === "string") &&
          (r.excludes === undefined || typeof r.excludes === "string") &&
          (r.action === "block" || r.action === "confirm") &&
          typeof r.reason === "string"
        );
      })
    );
  }

  getConfig(): ResolvedConfig {
    if (!this.resolved) {
      throw new Error("Config not loaded. Call load() first.");
    }
    return this.resolved;
  }

  async saveGlobal(config: GuardrailsConfig): Promise<void> {
    await this.saveConfigFile(GLOBAL_CONFIG_PATH, config);
    await this.load();
  }

  private async saveConfigFile(
    path: string,
    config: GuardrailsConfig,
  ): Promise<void> {
    await mkdir(dirname(path), { recursive: true });

    if (path === GLOBAL_CONFIG_PATH) {
      // For global config, merge into existing settings.json
      let existingSettings: Record<string, unknown> = {};
      try {
        const content = await readFile(path, "utf-8");
        existingSettings = JSON.parse(content);
      } catch {
        // File doesn't exist or invalid, use empty object
      }
      existingSettings.guardrails = config;
      await writeFile(
        path,
        `${JSON.stringify(existingSettings, null, 2)}\n`,
        "utf-8",
      );
    }
  }

  hasGlobalConfig(): boolean {
    return this.globalConfig !== null;
  }

  hasDefaultsConfig(): boolean {
    return this.defaultsConfig !== null;
  }

  getGlobalConfig(): GuardrailsConfig {
    return this.globalConfig ?? [];
  }

  getDefaultsConfig(): GuardrailsConfig {
    return this.defaultsConfig ?? [];
  }
}

export const configLoader = new ConfigLoader();
