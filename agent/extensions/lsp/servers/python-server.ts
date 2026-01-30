/**
 * Python Language Server
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { type LSPServerConfig } from "../core/types";
import { findRoot, spawnSimpleLanguageServer } from "../core/utils";

/**
 * Find Python project root
 */
export function findPythonRoot(file: string, cwd: string): string | undefined {
  return findRoot(file, cwd, [
    "pyproject.toml",
    "setup.py",
    "requirements.txt",
    "pyrightconfig.json",
  ]);
}

/**
 * Python server configuration
 */
export const pyrightServerConfig: LSPServerConfig = {
  id: "pyright",
  extensions: [".py", ".pyi"],
  findRoot: findPythonRoot,
  spawn: spawnSimpleLanguageServer("pyright-langserver", []),
};

export function getPyrightServerConfig() {
  return pyrightServerConfig;
}
