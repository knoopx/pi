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
  /**
   * Pattern used for matching:
   * - command context: AST-like command token pattern (`?`, `*`)
   * - file_name/file_content contexts: regular expression
   */
  pattern: string;
  /**
   * Optional regex pattern to filter which files this rule applies to.
   * Only used for file_name and file_content contexts.
   * If not specified, the rule applies to all files.
   */
  file_pattern?: string;
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

interface GuardrailsGroup {
  group: string;
  /**
   * File glob patterns to activate this group.
   * The group is activated if any matching file exists in the project root.
   */
  pattern: string;
  /**
   * Optional file glob pattern to deactivate this group.
   * If any matching file exists, the group is skipped even if `pattern` matches.
   */
  excludePattern?: string;
  rules: GuardrailsRule[];
}

export type GuardrailsConfig = GuardrailsGroup[];

export type ResolvedConfig = GuardrailsGroup[];

const GLOBAL_CONFIG_PATH = resolve(homedir(), ".pi/agent/settings.json");
const EXTENSION_CONFIG_PATH = resolve(
  import.meta.dirname || __dirname,
  "defaults.json",
);
const GUARDRAILS_SETTINGS_KEY = "guardrails";

interface GuardrailsSettings {
  enabled: boolean;
}

const DEFAULT_GUARDRAILS_SETTINGS: GuardrailsSettings = {
  enabled: true,
};

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function toSettingsRecord(parsed: unknown): Record<string, unknown> {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("settings.json must contain a JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function readGlobalSettingsOrEmpty(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(GLOBAL_CONFIG_PATH, "utf-8");
    return toSettingsRecord(JSON.parse(content));
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }
    throw new Error(
      "Unable to read settings.json safely; refusing to overwrite existing configuration.",
      { cause: error },
    );
  }
}

export async function loadGuardrailsSettings(): Promise<GuardrailsSettings> {
  const settings = await readGlobalSettingsOrEmpty();
  const raw = settings[GUARDRAILS_SETTINGS_KEY];

  if (raw === undefined || Array.isArray(raw)) {
    // Legacy format uses `guardrails` as rule array.
    return { ...DEFAULT_GUARDRAILS_SETTINGS };
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid guardrails settings format in settings.json");
  }

  const rawRecord = raw as Record<string, unknown>;

  return {
    enabled:
      typeof rawRecord.enabled === "boolean"
        ? rawRecord.enabled
        : DEFAULT_GUARDRAILS_SETTINGS.enabled,
  };
}

export async function saveGuardrailsSettings(
  updates: Partial<GuardrailsSettings>,
): Promise<GuardrailsSettings> {
  await mkdir(dirname(GLOBAL_CONFIG_PATH), { recursive: true });

  const existingSettings = await readGlobalSettingsOrEmpty();
  const current = await loadGuardrailsSettings();
  const next: GuardrailsSettings = {
    ...current,
    ...updates,
  };

  const currentGuardrailsValue = existingSettings[GUARDRAILS_SETTINGS_KEY];
  const guardrailsRecord =
    typeof currentGuardrailsValue === "object" &&
    currentGuardrailsValue !== null &&
    !Array.isArray(currentGuardrailsValue)
      ? (currentGuardrailsValue as Record<string, unknown>)
      : {};

  existingSettings[GUARDRAILS_SETTINGS_KEY] = {
    ...guardrailsRecord,
    enabled: next.enabled,
  };

  await writeFile(
    GLOBAL_CONFIG_PATH,
    `${JSON.stringify(existingSettings, null, 2)}\n`,
    "utf-8",
  );

  return next;
}

class GuardrailsConfigLoader {
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
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const guardrails = parsed.guardrails;

      // Legacy format: guardrails is an array of groups.
      if (Array.isArray(guardrails)) {
        return guardrails as GuardrailsConfig;
      }

      // Current format: guardrails is an object with a `rules` array.
      if (
        typeof guardrails === "object" &&
        guardrails !== null &&
        Array.isArray((guardrails as Record<string, unknown>).rules)
      ) {
        return (guardrails as { rules: GuardrailsConfig }).rules;
      }

      return null;
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
      (g.excludePattern === undefined ||
        typeof g.excludePattern === "string") &&
      Array.isArray(g.rules) &&
      g.rules.every((rule: unknown) => {
        const r = rule as Record<string, unknown>;
        return (
          typeof rule === "object" &&
          rule !== null &&
          typeof r.pattern === "string" &&
          (r.file_pattern === undefined ||
            typeof r.file_pattern === "string") &&
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
      const existingSettings = await readGlobalSettingsOrEmpty();
      const currentGuardrailsValue = existingSettings[GUARDRAILS_SETTINGS_KEY];

      const existingGuardrailsRecord =
        typeof currentGuardrailsValue === "object" &&
        currentGuardrailsValue !== null &&
        !Array.isArray(currentGuardrailsValue)
          ? (currentGuardrailsValue as Record<string, unknown>)
          : {};

      const enabled =
        typeof existingGuardrailsRecord.enabled === "boolean"
          ? existingGuardrailsRecord.enabled
          : DEFAULT_GUARDRAILS_SETTINGS.enabled;

      existingSettings[GUARDRAILS_SETTINGS_KEY] = {
        ...existingGuardrailsRecord,
        enabled,
        rules: config,
      };

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

export const configLoader = new GuardrailsConfigLoader();
