/**
 * TypeScript/JavaScript Language Server
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { ChildProcessWithoutNullStreams } from "node:child_process";

import { type LSPServerConfig } from "../core/types";
import { findNearestFile, findRoot, which, spawnChecked } from "../core/utils";

/**
 * Find TypeScript/JavaScript project root
 */
export function findTypeScriptRoot(
  file: string,
  cwd: string,
): string | undefined {
  if (findNearestFile(path.dirname(file), ["deno.json", "deno.jsonc"], cwd))
    return undefined;
  return findRoot(file, cwd, [
    "package.json",
    "tsconfig.json",
    "jsconfig.json",
  ]);
}

/**
 * Spawn TypeScript language server
 */
export async function spawnTypeScriptLanguageServer(
  root: string,
): Promise<
  { process: ChildProcessWithoutNullStreams; initOptions?: unknown } | undefined
> {
  // Fall back to local/PATH approach
  const local = path.join(root, "node_modules/.bin/typescript-language-server");
  const cmd = fs.existsSync(local)
    ? local
    : which("typescript-language-server");
  if (!cmd) return undefined;

  const child = await spawnChecked(cmd, ["--stdio"], root);
  if (!child) return undefined;

  // Use local tsserver if available
  const localTsserver = path.join(root, "node_modules/.bin/tsserver");
  const initOptions = fs.existsSync(localTsserver)
    ? { typescript: { serverPath: localTsserver } }
    : undefined;

  return { process: child, initOptions };
}

/**
 * TypeScript/JavaScript server configuration
 */
export const typescriptServerConfig: LSPServerConfig = {
  id: "typescript",
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
  findRoot: findTypeScriptRoot,
  spawn: spawnTypeScriptLanguageServer,
};

export function getTypescriptServerConfig() {
  return typescriptServerConfig;
}
