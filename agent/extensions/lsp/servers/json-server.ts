/**
 * JSON Language Server Configuration
 */

import { LSPServerConfig } from "../core/types";
import { which, spawn } from "../core/utils";

export const jsonServerConfig: LSPServerConfig = {
  id: "json",
  extensions: [".json"],
  findRoot: (_file, cwd) => cwd,
  spawn: async (root) => {
    const cmd =
      which("vscode-json-languageserver") || which("json-languageserver");
    if (!cmd) return undefined;
    return {
      process: spawn(cmd, ["--stdio"], {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    };
  },
};

export function getJsonServerConfig(): LSPServerConfig {
  return jsonServerConfig;
}
