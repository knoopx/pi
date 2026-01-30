/**
 * YAML Language Server Configuration
 */

import { LSPServerConfig } from "../core/types";
import { which, spawn } from "../core/utils";

export const yamlServerConfig: LSPServerConfig = {
  id: "yaml",
  extensions: [".yaml", ".yml"],
  findRoot: (_file, cwd) => cwd,
  spawn: async (root) => {
    const cmd = which("yaml-language-server");
    if (!cmd) return undefined;
    return {
      process: spawn(cmd, ["--stdio"], {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    };
  },
};

export function getYamlServerConfig(): LSPServerConfig {
  return yamlServerConfig;
}
