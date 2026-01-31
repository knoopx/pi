/**
 * Marksman Language Server Configuration
 * For Markdown file support
 */

import { LSPServerConfig } from "../core/types";
import { which, spawn } from "../core/utils";

export const marksmanServerConfig: LSPServerConfig = {
  id: "marksman",
  extensions: [".md"],
  findRoot: (file, cwd) => cwd,
  spawn: async (root) => {
    const cmd = which("marksman");
    if (!cmd) return undefined;
    return {
      process: spawn(cmd, ["server"], {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    };
  },
};

export function getMarksmanServerConfig(): LSPServerConfig {
  return marksmanServerConfig;
}
