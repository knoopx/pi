import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

/**
 * Configuration schema for the hooks extension.
 *
 * HooksConfig is the user-facing schema (all fields optional).
 * ResolvedConfig is the internal schema (all fields required, defaults applied).
 */

export type HookEvent =
  | "session_start"
  | "session_shutdown"
  | "tool_call"
  | "tool_result"
  | "agent_start"
  | "agent_end"
  | "turn_start"
  | "turn_end";

export type HookContext = "tool_name" | "file_name" | "command";

export interface HookRule {
  /** Event to trigger on */
  event: HookEvent;
  /** Context for pattern matching (only for tool_call/tool_result) */
  context?: HookContext;
  /** Regex pattern to match against context value */
  pattern?: string;
  /** Shell command to run */
  command: string;
  /** Working directory (defaults to cwd) */
  cwd?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to show output notification (default: true) */
  notify?: boolean;
}

export interface HooksGroup {
  /** Group name for identification */
  group: string;
  /**
   * File glob patterns to activate this group.
   * The group is activated if any matching file exists in the project root.
   */
  pattern: string;
  /** Hook rules for this group */
  hooks: HookRule[];
}

export type HooksConfig = HooksGroup[];

export type ResolvedConfig = HooksGroup[];

const GLOBAL_CONFIG_PATH = resolve(homedir(), ".pi/agent/settings.json");
const EXTENSION_CONFIG_PATH = resolve(
  import.meta.dirname || __dirname,
  "defaults.json",
);

class ConfigLoader {
  private defaultsConfig: HooksConfig | null = null;
  private globalConfig: HooksConfig | null = null;
  private resolved: ResolvedConfig | null = null;

  async load(): Promise<void> {
    this.defaultsConfig = await this.loadDefaultsFile();
    this.globalConfig = await this.loadGlobalFile();
    this.resolved = this.mergeConfigs();
  }

  private async loadDefaultsFile(): Promise<HooksConfig | null> {
    try {
      const content = await readFile(EXTENSION_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? (parsed as HooksConfig) : null;
    } catch {
      return null;
    }
  }

  private async loadGlobalFile(): Promise<HooksConfig | null> {
    try {
      const content = await readFile(GLOBAL_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      const hooks = parsed.hooks;
      return Array.isArray(hooks) ? (hooks as HooksConfig) : null;
    } catch {
      return null;
    }
  }

  private mergeConfigs(): ResolvedConfig {
    // Use global config if it exists, otherwise use defaults
    const config = this.globalConfig ?? this.defaultsConfig ?? [];
    return config.filter(this.isValidGroup);
  }

  private isValidGroup(group: unknown): group is HooksGroup {
    if (typeof group !== "object" || group === null) {
      return false;
    }

    const g = group as Record<string, unknown>;

    if (typeof g.group !== "string" || typeof g.pattern !== "string") {
      return false;
    }

    if (!Array.isArray(g.hooks)) {
      return false;
    }

    return g.hooks.every((hook: unknown) => {
      if (typeof hook !== "object" || hook === null) {
        return false;
      }

      const h = hook as Record<string, unknown>;

      const validEvents = [
        "session_start",
        "session_shutdown",
        "tool_call",
        "tool_result",
        "agent_start",
        "agent_end",
        "turn_start",
        "turn_end",
      ];

      const validContexts = ["tool_name", "file_name", "command"];

      if (typeof h.event !== "string" || !validEvents.includes(h.event)) {
        return false;
      }

      if (typeof h.command !== "string") {
        return false;
      }

      if (h.context !== undefined) {
        if (
          typeof h.context !== "string" ||
          !validContexts.includes(h.context)
        ) {
          return false;
        }
      }

      if (h.pattern !== undefined && typeof h.pattern !== "string") {
        return false;
      }

      if (h.cwd !== undefined && typeof h.cwd !== "string") {
        return false;
      }

      if (h.timeout !== undefined && typeof h.timeout !== "number") {
        return false;
      }

      if (h.notify !== undefined && typeof h.notify !== "boolean") {
        return false;
      }

      return true;
    });
  }

  getConfig(): ResolvedConfig {
    if (!this.resolved) {
      throw new Error("Config not loaded. Call load() first.");
    }
    return this.resolved;
  }

  async saveGlobal(config: HooksConfig): Promise<void> {
    await this.saveConfigFile(GLOBAL_CONFIG_PATH, config);
    await this.load();
  }

  private async saveConfigFile(
    path: string,
    config: HooksConfig,
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
      existingSettings.hooks = config;
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

  getGlobalConfig(): HooksConfig {
    return this.globalConfig ?? [];
  }

  getDefaultsConfig(): HooksConfig {
    return this.defaultsConfig ?? [];
  }
}

export const configLoader = new ConfigLoader();
