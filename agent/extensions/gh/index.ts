import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { dangerousOperationConfirmation } from "../../shared/tool-utils";
import { renderTextToolResult } from "../../shared/render-utils";
import {
  dotJoin,
  countLabel,
  table,
  detail,
  stateDot,
} from "../../shared/renderers";
import type { Column } from "../../shared/renderers";

// Type definitions
interface GHRepo {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  forks_url: string;
  stargazers_url: string;
  watchers_url: string;
  language: string | null;
  forks_count: number;
  stargazers_count: number;
  watchers_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  default_branch: string;
}

interface GHFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
}

interface GistFile {
  filename: string;
  type: string;
  language: string | null;
  content: string;
  raw_url: string;
  size: number;
}

interface Gist {
  id: string;
  description: string | null;
  public: boolean;
  created_at: string;
  updated_at: string;
  html_url: string;
  files: Record<string, GistFile>;
  user: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
}

interface SearchResult {
  query: string;
  results: GHRepo[];
  total: number;
}

interface FileContentResult {
  repo: string;
  path: string;
  content: string;
  type: "file" | "directory";
  size?: number;
}

/**
 * Execute gh CLI command and return output
 */
async function ghCmd(
  args: string[],
  options?: { stdio?: "inherit" | "pipe" },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { spawn } = await import("node:child_process");
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>(
    (resolve, reject) => {
      const proc = spawn("gh", args, {
        stdio: options?.stdio === "inherit" ? "inherit" : "pipe",
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code: number) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      proc.on("error", (err) => {
        reject(err);
      });
    },
  );
}

/**
 * Authenticate with GitHub using gh CLI
 */
export async function authLogin(
  host?: string,
  scopes?: string[],
  webAuth = false,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["auth", "login"];
  if (host) {
    args.push("--host", host);
  }
  if (scopes && scopes.length > 0) {
    args.push("--scopes", scopes.join(","));
  }
  if (webAuth) {
    args.push("--web");
  }
  return ghCmd(args);
}

/**
 * Log out from GitHub
 */
export async function authLogout(host?: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const args = ["auth", "logout"];
  if (host) {
    args.push("--host", host);
  }
  return ghCmd(args);
}

/**
 * Check authentication status
 */
export async function authStatus(): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["auth", "status"]);
}

/**
 * Get authentication token
 */
export async function authToken(
  host?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["auth", "token"];
  if (host) {
    args.push("--host", host);
  }
  return ghCmd(args);
}

/**
 * List organizations for authenticated user
 */
export async function listOrgs(limit = 100): Promise<GHOrg[]> {
  const result = await ghCmd([
    "api",
    `/user/orgs?per_page=${limit}`,
    "--jq",
    "[.[] | {id, login, name, description, html_url, avatar_url}]",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh api orgs failed: ${result.stderr || result.stdout}`);
  }

  let orgs: GHOrg[] = [];
  try {
    orgs = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh api orgs output: ${result.stdout}`);
  }

  return orgs;
}

/**
 * List aliases
 */
export async function listAliases(): Promise<GHAlias[]> {
  const result = await ghCmd(["alias", "list"]);

  if (result.exitCode !== 0) {
    throw new Error(`gh alias list failed: ${result.stderr || result.stdout}`);
  }

  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const aliases: GHAlias[] = lines.map((line) => {
    const colonIdx = line.indexOf(":");
    const name = line.substring(0, colonIdx).trim();
    const expansion = line.substring(colonIdx + 1).trim();
    return { name, expansion };
  });

  return aliases;
}

/**
 * Set an alias
 */
export async function setAlias(
  name: string,
  expansion: string,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["alias", "set", name, expansion]);
}

/**
 * Delete an alias
 */
export async function deleteAlias(name: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["alias", "delete", name]);
}

/**
 * Get config value
 */
export async function getConfig(
  key: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["config", "get", key]);
}

/**
 * Set config value
 */
export async function setConfig(
  key: string,
  value: string,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["config", "set", key, value]);
}

/**
 * List config values
 */
export async function listConfig(): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["config", "list"]);
}

/**
 * List installed extensions
 */
export async function listExtensions(): Promise<GHExtension[]> {
  const result = await ghCmd(["extension", "list"]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh extension list failed: ${result.stderr || result.stdout}`,
    );
  }

  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const extensions: GHExtension[] = lines.map((line) => {
    const parts = line.split(/\s+/).filter(Boolean);
    const name = parts[0] ?? "";
    const version = parts[1] ?? "";
    return { name, version };
  });

  return extensions;
}

/**
 * Install an extension
 */
export async function installExtension(repo: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["extension", "install", repo]);
}

/**
 * Remove an extension
 */
export async function removeExtension(name: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["extension", "remove", name]);
}

/**
 * List GPG keys
 */
export async function listGpgKeys(): Promise<GHGpgKey[]> {
  const result = await ghCmd(["gpg-key", "list"]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh gpg-key list failed: ${result.stderr || result.stdout}`,
    );
  }

  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const keys: GHGpgKey[] = lines.map((line) => {
    const parts = line.split(/\s+/).filter(Boolean);
    return {
      id: parts[0] ?? "",
      keyId: parts[1] ?? "",
      createdAt: parts[2] ?? "",
    };
  });

  return keys;
}

/**
 * Add a GPG key
 */
export async function addGpgKey(keyId: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["gpg-key", "add", keyId]);
}

/**
 * Delete a GPG key
 */
export async function deleteGpgKey(keyId: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["gpg-key", "delete", keyId]);
}

/**
 * List secrets (repository or organization)
 */
export async function listSecrets(
  owner: string,
  repo: string,
): Promise<GHSecret[]> {
  const result = await ghCmd([
    "secret",
    "list",
    "-R",
    `${owner}/${repo}`,
    "--json=name,updatedAt",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh secret list failed: ${result.stderr || result.stdout}`);
  }

  let secrets: GHSecret[] = [];
  try {
    secrets = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh secret list output: ${result.stdout}`);
  }

  return secrets;
}

/**
 * Set a secret
 */
export async function setSecret(
  owner: string,
  repo: string,
  name: string,
  value: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "gh",
      ["secret", "set", name, "-R", `${owner}/${repo}`],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    proc.stdin.write(value);
    proc.stdin.end();
    proc.on("close", (code: number) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Delete a secret
 */
export async function deleteSecret(
  owner: string,
  repo: string,
  name: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["secret", "delete", name, "-R", `${owner}/${repo}`]);
}

/**
 * List SSH keys
 */
export async function listSshKeys(): Promise<GHSshKey[]> {
  const result = await ghCmd(["ssh-key", "list"]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh ssh-key list failed: ${result.stderr || result.stdout}`,
    );
  }

  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const keys: GHSshKey[] = lines.map((line) => {
    const parts = line.split(/\s+/).filter(Boolean);
    return {
      id: parts[0] ?? "",
      keyId: parts[1] ?? "",
      title: parts[2] ?? "",
      createdAt: parts[3] ?? "",
    };
  });

  return keys;
}

/**
 * Add an SSH key
 */
export async function addSshKey(
  title: string,
  key: string,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["ssh-key", "add", "--title", title, key]);
}

/**
 * Delete an SSH key
 */
export async function deleteSshKey(keyId: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["ssh-key", "delete", keyId]);
}

/**
 * List GitHub Actions caches
 */
export async function listCaches(
  owner: string,
  repo: string,
  limit = 30,
): Promise<GHCache[]> {
  const result = await ghCmd([
    "cache",
    "list",
    "-R",
    `${owner}/${repo}`,
    `--limit=${limit}`,
    "--json=id,key,sizeInBytes,lastAccessedAt",
    "--jq",
    "[.[] | {id, key, size_in_bytes: .sizeInBytes, last_accessed_at: .lastAccessedAt}]",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh cache list failed: ${result.stderr || result.stdout}`);
  }

  let caches: GHCache[] = [];
  try {
    caches = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh cache list output: ${result.stdout}`);
  }

  return caches;
}

/**
 * Delete a GitHub Actions cache
 */
export async function deleteCache(
  owner: string,
  repo: string,
  cacheId: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["cache", "delete", `${cacheId}`, "-R", `${owner}/${repo}`]);
}

/**
 * List workflow variables
 */
export async function listVariables(
  owner: string,
  repo: string,
): Promise<GHVariable[]> {
  const result = await ghCmd([
    "variable",
    "list",
    "-R",
    `${owner}/${repo}`,
    "--json=name,value",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh variable list failed: ${result.stderr || result.stdout}`,
    );
  }

  let variables: GHVariable[] = [];
  try {
    variables = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Failed to parse gh variable list output: ${result.stdout}`,
    );
  }

  return variables;
}

/**
 * Get a variable value
 */
export async function getVariable(
  owner: string,
  repo: string,
  name: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["variable", "get", name, "-R", `${owner}/${repo}`]);
}

/**
 * Set a variable
 */
export async function setVariable(
  owner: string,
  repo: string,
  name: string,
  value: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd([
    "variable",
    "set",
    name,
    "-R",
    `${owner}/${repo}`,
    "--body",
    value,
  ]);
}

/**
 * Delete a variable
 */
export async function deleteVariable(
  owner: string,
  repo: string,
  name: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["variable", "delete", name, "-R", `${owner}/${repo}`]);
}

/**
 * Check status (show authentication status)
 */
export async function status(): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(["status"]);
}

/**
 * List rulesets for a repository
 */
export async function listRulesets(
  owner: string,
  repo: string,
): Promise<GHRuleset[]> {
  const result = await ghCmd([
    "api",
    `/repos/${owner}/${repo}/rulesets`,
    "--jq",
    "[.[] | {id, name, source_type, source, enforcement}]",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh api rulesets failed: ${result.stderr || result.stdout}`,
    );
  }

  let rulesets: GHRuleset[] = [];
  try {
    rulesets = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh api rulesets output: ${result.stdout}`);
  }

  return rulesets;
}

/**
 * View a ruleset
 */
export async function viewRuleset(
  owner: string,
  repo: string,
  rulesetId: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["api", `/repos/${owner}/${repo}/rulesets/${rulesetId}`]);
}

/**
 * List projects for an owner
 */
export async function listProjects(
  owner: string,
  type: "user" | "organization" = "user",
): Promise<GHProject[]> {
  const endpoint =
    type === "organization"
      ? `/orgs/${owner}/projects`
      : `/users/${owner}/projects`;

  const result = await ghCmd([
    "api",
    endpoint,
    "--jq",
    "[.[] | {id, number, title, state, url}]",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh api projects failed: ${result.stderr || result.stdout}`,
    );
  }

  let projects: GHProject[] = [];
  try {
    projects = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh api projects output: ${result.stdout}`);
  }

  return projects;
}

/**
 * View a project
 */
export async function viewProject(
  projectId: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["api", `/projects/${projectId}`]);
}

/**
 * Search for repositories on GitHub using gh CLI
 */
export async function searchRepos(
  query: string,
  limit = 20,
): Promise<SearchResult> {
  const result = await ghCmd([
    "search",
    "repos",
    query,
    `--limit=${limit}`,
    "--json=name,fullName,description,url,language,stargazersCount,forksCount",
    "--jq",
    "[.[] | {name, full_name: .fullName, description, html_url: .url, language, stargazers_count: .stargazersCount, forks_count: .forksCount}]",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh search repos failed: ${result.stderr || result.stdout}`,
    );
  }

  let repos: GHRepo[] = [];
  try {
    repos = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh search repos output: ${result.stdout}`);
  }

  return {
    query,
    results: repos,
    total: repos.length,
  } as SearchResult;
}

/**
 * Get repository contents (files and directories) using gh CLI
 */
export async function getRepoContents(
  owner: string,
  repo: string,
  path = "",
): Promise<GHFile[]> {
  const pathArg = path ? `/${path}` : "";
  const result = await ghCmd([
    "api",
    `/repos/${owner}/${repo}/contents${pathArg}`,
    "--jq",
    "[.[] | {name, path, type, size, url, html_url, download_url: .download_url, sha}]",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh api failed: ${result.stderr || result.stdout}`);
  }

  let contents: GHFile[] = [];
  try {
    contents = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh api output: ${result.stdout}`);
  }

  return contents;
}

/**
 * Get file content from a repository using gh CLI
 */
export async function getFileContent(
  owner: string,
  repo: string,
  filePath: string,
  ref?: string,
): Promise<FileContentResult> {
  let endpoint = `/repos/${owner}/${repo}/contents/${filePath}`;
  if (ref) {
    endpoint += `?ref=${encodeURIComponent(ref)}`;
  }
  const args = ["api", endpoint];

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
      throw new Error(
        `File not found: ${owner}/${repo}/${filePath}${ref ? ` at ref ${ref}` : ""}`,
      );
    }
    throw new Error(errorMessage);
  }

  const data: GHFile = JSON.parse(result.stdout);

  if (!data.content || !data.encoding) {
    throw new Error(
      `File is binary or too large to display. File size: ${data.size} bytes`,
    );
  }

  return {
    repo: `${owner}/${repo}`,
    path: filePath,
    content: Buffer.from(data.content, "base64").toString("utf-8"),
    type: data.type === "file" ? "file" : "directory",
    size: data.size,
  };
}

/**
 * List gists using gh CLI (requires authentication)
 */
export async function listGists(
  userId?: string,
  limit = 30,
  _since?: Date,
): Promise<Gist[]> {
  // gh gist list only lists the authenticated user's gists.
  // For other users, use the API endpoint directly.
  if (userId && userId !== "@me") {
    const endpoint = `/users/${userId}/gists?per_page=${limit}`;
    const result = await ghCmd([
      "api",
      endpoint,
      "--jq",
      "[.[] | {id, description, public, created_at, updated_at, html_url, files, user: (.owner // null)}]",
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`gh api gists failed: ${result.stderr || result.stdout}`);
    }

    return JSON.parse(result.stdout) as Gist[];
  }

  // For own gists, use gh gist list (plain text) then fetch details via API
  const result = await ghCmd(["gist", "list", `--limit=${limit}`]);

  if (result.exitCode !== 0) {
    throw new Error(`gh gist list failed: ${result.stderr || result.stdout}`);
  }

  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const gistIds = lines.map((line) => line.split(/\s+/)[0]);

  // Fetch details for each gist via API
  const gists: Gist[] = [];
  for (const gistId of gistIds) {
    try {
      const gist = await getGist(gistId);
      gists.push(gist);
    } catch {
      // Skip gists that fail to load
    }
  }

  return gists;
}

/**
 * Get specific gist details using gh CLI
 */
export async function getGist(gistId: string): Promise<Gist> {
  const result = await ghCmd(["api", `/gists/${gistId}`]);

  if (result.exitCode !== 0) {
    throw new Error(`gh api gist failed: ${result.stderr || result.stdout}`);
  }

  const gist: Gist = JSON.parse(result.stdout);

  return gist;
}

/**
 * Create a new gist using gh CLI
 */
export async function createGist(
  files: Record<string, { content: string; filename?: string }>,
  description = "",
  isPublic = false,
): Promise<Gist> {
  // Create temp files for gh gist create
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");

  const tempDir = os.tmpdir();
  const fileArgs: string[] = [];

  for (const [filename, fileData] of Object.entries(files)) {
    const tempFile = path.join(tempDir, `gist-${filename}`);
    fs.writeFileSync(tempFile, fileData.content);
    fileArgs.push(tempFile);
  }

  const args = ["gist", "create", ...fileArgs];
  if (description) {
    args.push("--desc", description);
  }
  if (isPublic) {
    args.push("--public");
  }

  const result = await ghCmd(args);

  // Cleanup temp files
  for (const tempFile of fileArgs) {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }

  if (result.exitCode !== 0) {
    throw new Error(`gh gist create failed: ${result.stderr || result.stdout}`);
  }

  // gh gist create outputs the gist URL; extract ID and fetch details via API
  const gistUrl = result.stdout.trim();
  const gistId = gistUrl.split("/").pop();
  if (!gistId) {
    throw new Error(`Failed to extract gist ID from output: ${gistUrl}`);
  }

  return getGist(gistId);
}

/**
 * Update an existing gist using gh CLI
 */
export async function updateGist(
  gistId: string,
  files?: Record<string, { content: string; filename?: string }>,
  description?: string,
): Promise<Gist> {
  // Use gh api to update gist directly — gh gist edit opens an interactive editor
  const apiBody: Record<string, unknown> = {};
  if (description !== undefined) {
    apiBody.description = description;
  }
  if (files) {
    const apiFiles: Record<string, { content: string; filename?: string }> = {};
    for (const [filename, fileData] of Object.entries(files)) {
      apiFiles[filename] = { content: fileData.content };
      if (fileData.filename) {
        apiFiles[filename].filename = fileData.filename;
      }
    }
    apiBody.files = apiFiles;
  }

  // Pipe JSON body via stdin to gh api
  const { spawn } = await import("node:child_process");
  const apiResult = await new Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>((resolve, reject) => {
    const proc = spawn(
      "gh",
      ["api", `/gists/${gistId}`, "-X", "PATCH", "--input", "-"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    proc.stdin.write(JSON.stringify(apiBody));
    proc.stdin.end();
    proc.on("close", (code: number) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
    proc.on("error", (err) => {
      reject(err);
    });
  });

  if (apiResult.exitCode !== 0) {
    throw new Error(
      `gh api gist update failed: ${apiResult.stderr || apiResult.stdout}`,
    );
  }

  return JSON.parse(apiResult.stdout) as Gist;
}

/**
 * View repository details using gh CLI
 */
export async function viewRepo(owner: string, repo: string): Promise<GHRepo> {
  const result = await ghCmd(["api", `/repos/${owner}/${repo}`]);

  if (result.exitCode !== 0) {
    throw new Error(`gh api repo failed: ${result.stderr || result.stdout}`);
  }

  let repoData: GHRepo;
  try {
    repoData = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh api repo output: ${result.stdout}`);
  }

  return repoData;
}

/**
 * Delete a gist using gh CLI
 */
export async function deleteGist(gistId: string): Promise<void> {
  const result = await ghCmd(["gist", "delete", gistId, "--yes"]);

  if (result.exitCode !== 0) {
    throw new Error(`gh gist delete failed: ${result.stderr || result.stdout}`);
  }
}

/**
 * Search code in repositories using gh CLI
 */
export async function searchCode(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHCodeSearchResult[]; total: number }> {
  const result = await ghCmd([
    "search",
    "code",
    query,
    `--limit=${limit}`,
    "--json=repository,path,sha,textMatches,url",
    "--jq",
    '[.[] | {repo: ((.repository.nameWithOwner // "") | split("/") | .[1] // ""), owner: ((.repository.nameWithOwner // "") | split("/") | .[0] // ""), name: (.path | split("/") | .[-1]), path, html_url: .url, text_matches: [.textMatches[]? | {snippet: .fragment, matches: [.matches[]? | .text]}]}]',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh search code failed: ${result.stderr || result.stdout}`);
  }

  let results: GHCodeSearchResult[] = [];
  try {
    results = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh search code output: ${result.stdout}`);
  }

  return {
    query,
    results,
    total: results.length,
  };
}

/**
 * Search issues using gh CLI
 */
export async function searchIssues(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHIssueSearchResult[]; total: number }> {
  const result = await ghCmd([
    "search",
    "issues",
    query,
    `--limit=${limit}`,
    "--json=number,title,state,repository,createdAt,labels,url",
    "--jq",
    '[.[] | {number, title, state, repo: (.repository.name // ""), owner: (.repository.owner // ""), createdAt, labels: [.labels[:5][]? | {name}], url}]',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh search issues failed: ${result.stderr || result.stdout}`,
    );
  }

  let results: GHIssueSearchResult[] = [];
  try {
    results = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Failed to parse gh search issues output: ${result.stdout}`,
    );
  }

  return {
    query,
    results,
    total: results.length,
  };
}

/**
 * Search PRs using gh CLI
 */
export async function searchPRs(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHPRSearchResult[]; total: number }> {
  const result = await ghCmd([
    "search",
    "prs",
    query,
    `--limit=${limit}`,
    "--json=number,title,state,repository,createdAt,updatedAt,labels,url",
    "--jq",
    '[.[] | {number, title, state, repo: (.repository.name // ""), owner: (.repository.owner // ""), createdAt, updatedAt, labels: [.labels[:5][]? | {name}], url, mergeable: ""}]',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh search prs failed: ${result.stderr || result.stdout}`);
  }

  let results: GHPRSearchResult[] = [];
  try {
    results = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh search prs output: ${result.stdout}`);
  }

  return {
    query,
    results,
    total: results.length,
  };
}

/**
 * Clone a gist using gh CLI
 */
export async function cloneGist(
  gistId: string,
  directory?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["gist", "clone", gistId];
  if (directory) {
    args.push(directory);
  }

  return ghCmd(args);
}

/**
 * List repository files with content preview
 */
export async function listRepoFiles(
  owner: string,
  repo: string,
  path = "",
  maxFiles = 50,
): Promise<{ files: GHFile[]; count: number }> {
  const contents = await getRepoContents(owner, repo, path);
  const files: GHFile[] = [];

  for (const item of contents) {
    if (files.length >= maxFiles) break;

    if (item.type === "file") {
      files.push(item);
    } else if (item.type === "dir") {
      // For directories, get a preview of contents
      try {
        const subContents = await getRepoContents(owner, repo, item.path);
        const subFiles = subContents
          .filter((c) => c.type === "file")
          .slice(0, 5);
        files.push({
          ...item,
          name: `${item.name}/ (${subFiles.length} files)`,
        });
      } catch {
        files.push(item);
      }
    }
  }

  return { files, count: files.length };
}

/**
 * Open a GitHub resource in browser using gh browse
 */
export async function browseResource(
  owner: string,
  repo: string,
  resource?: string,
  options?: {
    branch?: string;
    commit?: string;
    actions?: boolean;
    projects?: boolean;
    releases?: boolean;
    settings?: boolean;
    wiki?: boolean;
  },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["browse", "-R", `${owner}/${repo}`];

  if (resource) {
    args.push(resource);
  }

  if (options?.branch) {
    args.push("--branch", options.branch);
  }
  if (options?.commit) {
    args.push("--commit", options.commit);
  }
  if (options?.actions) {
    args.push("--actions");
  }
  if (options?.projects) {
    args.push("--projects");
  }
  if (options?.releases) {
    args.push("--releases");
  }
  if (options?.settings) {
    args.push("--settings");
  }
  if (options?.wiki) {
    args.push("--wiki");
  }

  return ghCmd(args);
}

/**
 * List PRs in a repository
 */
export async function listPRs(
  owner: string,
  repo: string,
  state?: "open" | "closed" | "merged" | "all",
  limit = 30,
): Promise<GHPR[]> {
  const args = ["pr", "list", "-R", `${owner}/${repo}`, `--limit=${limit}`];
  if (state && state !== "all") {
    args.push(`--state=${state}`);
  }
  args.push(
    "--json=number,title,state,createdAt,updatedAt,baseRefName,headRefName,author,url,mergeable,reviewDecision",
    "--jq",
    "[.[] | . + {html_url: .url}]",
  );

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    throw new Error(`gh pr list failed: ${result.stderr || result.stdout}`);
  }

  let prs: GHPR[] = [];
  try {
    prs = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh pr list output: ${result.stdout}`);
  }

  return prs;
}

/**
 * View a PR
 */
export async function viewPR(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GHPR> {
  const result = await ghCmd([
    "pr",
    "view",
    `${prNumber}`,
    "-R",
    `${owner}/${repo}`,
    "--json=number,title,state,createdAt,updatedAt,baseRefName,headRefName,author,body,url,mergeable,reviewDecision,mergeCommit,isCrossRepository",
    "--jq",
    ". + {html_url: .url}",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh pr view failed: ${result.stderr || result.stdout}`);
  }

  let pr: GHPR;
  try {
    pr = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh pr view output: ${result.stdout}`);
  }

  return pr;
}

/**
 * Checkout a PR locally
 */
export async function checkoutPR(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["pr", "checkout", `${prNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Merge a PR
 */
export async function mergePR(
  owner: string,
  repo: string,
  prNumber: number,
  mergeMethod?: "merge" | "squash" | "rebase",
  deleteBranch?: boolean,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["pr", "merge", `${prNumber}`, "-R", `${owner}/${repo}`];

  if (mergeMethod === "squash") {
    args.push("--squash");
  } else if (mergeMethod === "rebase") {
    args.push("--rebase");
  } else {
    args.push("--merge");
  }

  if (deleteBranch) {
    args.push("--delete-branch");
  }

  return ghCmd(args);
}

/**
 * Create a PR
 */
export async function createPR(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  head?: string,
  base?: string,
  draft?: boolean,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["pr", "create", "-R", `${owner}/${repo}`, "--title", title];

  if (body) {
    args.push("--body", body);
  }
  if (head) {
    args.push("--head", head);
  }
  if (base) {
    args.push("--base", base);
  }
  if (draft) {
    args.push("--draft");
  }

  return ghCmd(args);
}

/**
 * List issues in a repository
 */
export async function listIssues(
  owner: string,
  repo: string,
  state?: "open" | "closed" | "all",
  limit = 30,
): Promise<GHIssue[]> {
  const args = ["issue", "list", "-R", `${owner}/${repo}`, `--limit=${limit}`];
  if (state && state !== "all") {
    args.push(`--state=${state}`);
  }
  args.push(
    "--json=number,title,state,createdAt,updatedAt,author,body,url,labels,milestone",
    "--jq",
    "[.[] | . + {html_url: .url}]",
  );

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    throw new Error(`gh issue list failed: ${result.stderr || result.stdout}`);
  }

  let issues: GHIssue[] = [];
  try {
    issues = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh issue list output: ${result.stdout}`);
  }

  return issues;
}

/**
 * View an issue
 */
export async function viewIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GHIssue> {
  const result = await ghCmd([
    "issue",
    "view",
    `${issueNumber}`,
    "-R",
    `${owner}/${repo}`,
    "--json=number,title,state,createdAt,updatedAt,author,body,url,labels,milestone",
    "--jq",
    ". + {html_url: .url}",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh issue view failed: ${result.stderr || result.stdout}`);
  }

  let issue: GHIssue;
  try {
    issue = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh issue view output: ${result.stdout}`);
  }

  return issue;
}

/**
 * Create an issue
 */
export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["issue", "create", "-R", `${owner}/${repo}`, "--title", title];

  if (body) {
    args.push("--body", body);
  }
  if (labels && labels.length > 0) {
    args.push("--label", labels.join(","));
  }

  return ghCmd(args);
}

/**
 * List releases in a repository
 */
export async function listReleases(
  owner: string,
  repo: string,
  limit = 30,
): Promise<GHRelease[]> {
  const args = [
    "release",
    "list",
    "-R",
    `${owner}/${repo}`,
    `--limit=${limit}`,
    "--json=tagName,name,publishedAt,isDraft,isPrerelease",
    "--jq",
    '[.[] | {tagName, name, publishedAt, url: "", draft: .isDraft, isPrerelease, assets: []}]',
  ];

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh release list failed: ${result.stderr || result.stdout}`,
    );
  }

  let releases: GHRelease[] = [];
  try {
    releases = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh release list output: ${result.stdout}`);
  }

  return releases;
}

/**
 * View a release
 */
export async function viewRelease(
  owner: string,
  repo: string,
  tag: string,
): Promise<GHRelease> {
  const result = await ghCmd([
    "release",
    "view",
    tag,
    "-R",
    `${owner}/${repo}`,
    "--json=tagName,name,publishedAt,url,isDraft,isPrerelease,assets",
    "--jq",
    "{tagName, name, publishedAt, url, draft: .isDraft, isPrerelease, assets}",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh release view failed: ${result.stderr || result.stdout}`,
    );
  }

  let release: GHRelease;
  try {
    release = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh release view output: ${result.stdout}`);
  }

  return release;
}

/**
 * List repository labels
 */
export async function listLabels(
  owner: string,
  repo: string,
  limit = 100,
): Promise<GHLabel[]> {
  const result = await ghCmd([
    "label",
    "list",
    "-R",
    `${owner}/${repo}`,
    `--limit=${limit}`,
    "--json=name,description,color",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh label list failed: ${result.stderr || result.stdout}`);
  }

  let labels: GHLabel[] = [];
  try {
    labels = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh label list output: ${result.stdout}`);
  }

  return labels;
}

/**
 * Fork a repository using gh CLI
 */
export async function forkRepo(
  owner: string,
  repo: string,
  directory?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["repo", "fork", `${owner}/${repo}`];
  if (directory) {
    args.push("--clone");
  }

  return ghCmd(args);
}

/**
 * Create a new repository using gh CLI
 */
export async function createRepo(
  name: string,
  organization?: string,
  description?: string,
  publicRepo = true,
  template?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["repo", "create", name, publicRepo ? "--public" : "--private"];

  if (organization) {
    args.push(`--organization=${organization}`);
  }
  if (description) {
    args.push("--description", description);
  }
  if (template) {
    args.push(`--template=${template}`);
  }

  return ghCmd(args);
}

/**
 * List repositories using gh CLI
 */
export async function listRepos(
  user?: string,
  visibility?: "public" | "private" | "internal",
  source?: "fork" | "source",
  limit = 30,
): Promise<GHRepo[]> {
  const args = ["repo", "list"];
  if (user) {
    args.push(user);
  }
  if (visibility) {
    args.push(`--visibility=${visibility}`);
  }
  if (source === "fork") {
    args.push("--fork");
  } else if (source === "source") {
    args.push("--source");
  }
  args.push(`--limit=${limit}`);

  // Use gh api for REST-compatible field names matching GHRepo interface
  // gh repo list --json uses GraphQL field names, so we use the API instead
  const result = await ghCmd([
    ...args,
    "--json=name,nameWithOwner,isPrivate,description,url,primaryLanguage",
    "--jq",
    "[.[] | {name, full_name: .nameWithOwner, private: .isPrivate, description, html_url: .url, language: (.primaryLanguage.name // null)}]",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh repo list failed: ${result.stderr || result.stdout}`);
  }

  let repos: GHRepo[] = [];
  try {
    repos = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh repo list output: ${result.stdout}`);
  }

  return repos;
}

/**
 * Sync a fork repository with upstream using gh CLI
 */
export async function syncFork(
  owner: string,
  repo: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["repo", "sync", `${owner}/${repo}`]);
}

/**
 * Close an issue using gh CLI
 */
export async function closeIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  closeComment?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["issue", "close", `${issueNumber}`, "-R", `${owner}/${repo}`];
  if (closeComment) {
    args.push("--comment", closeComment);
  }
  return ghCmd(args);
}

/**
 * Delete an issue using gh CLI
 */
export async function deleteIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["issue", "delete", `${issueNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Reopen an issue using gh CLI
 */
export async function reopenIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  reopenComment?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["issue", "reopen", `${issueNumber}`, "-R", `${owner}/${repo}`];
  if (reopenComment) {
    args.push("--comment", reopenComment);
  }
  return ghCmd(args);
}

/**
 * Add a comment to an issue using gh CLI
 */
export async function addIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd([
    "issue",
    "comment",
    `${issueNumber}`,
    "-R",
    `${owner}/${repo}`,
    "--body",
    body,
  ]);
}

/**
 * Edit an issue using gh CLI
 */
export async function editIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  options?: {
    title?: string;
    addLabels?: string[];
    removeLabels?: string[];
    assignees?: string[];
    removeAssignees?: string[];
    body?: string;
    milestone?: number;
  },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["issue", "edit", `${issueNumber}`, "-R", `${owner}/${repo}`];

  if (options?.title) {
    args.push("--title", options.title);
  }
  if (options?.addLabels && options.addLabels.length > 0) {
    args.push("--add-label", options.addLabels.join(","));
  }
  if (options?.removeLabels && options.removeLabels.length > 0) {
    args.push("--remove-label", options.removeLabels.join(","));
  }
  if (options?.assignees && options.assignees.length > 0) {
    args.push("--add-assignee", options.assignees.join(","));
  }
  if (options?.removeAssignees && options.removeAssignees.length > 0) {
    args.push("--remove-assignee", options.removeAssignees.join(","));
  }
  if (options?.body) {
    args.push("--body", options.body);
  }
  if (options?.milestone) {
    args.push("--milestone", options.milestone.toString());
  }

  return ghCmd(args);
}

/**
 * Lock an issue using gh CLI
 */
export async function lockIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["issue", "lock", `${issueNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Unlock an issue using gh CLI
 */
export async function unlockIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["issue", "unlock", `${issueNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Pin an issue using gh CLI
 */
export async function pinIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["issue", "pin", `${issueNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Unpin an issue using gh CLI
 */
export async function unpinIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["issue", "unpin", `${issueNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Transfer an issue using gh CLI
 */
export async function transferIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  destinationRepo: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd([
    "issue",
    "transfer",
    `${issueNumber}`,
    destinationRepo,
    "-R",
    `${owner}/${repo}`,
  ]);
}

/**
 * Develop an issue using gh CLI
 */
export async function developIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd([
    "issue",
    "develop",
    `${issueNumber}`,
    "-R",
    `${owner}/${repo}`,
  ]);
}

/**
 * View PR checks/status using gh CLI
 */
export async function prChecks(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["pr", "checks", `${prNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * View PR diff using gh CLI
 */
export async function prDiff(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["pr", "diff", `${prNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Lock a PR using gh CLI
 */
export async function lockPR(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["pr", "lock", `${prNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Unlock a PR using gh CLI
 */
export async function unlockPR(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["pr", "unlock", `${prNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Revert a PR using gh CLI
 */
export async function revertPR(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["pr", "revert", `${prNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Update PR branch using gh CLI
 */
export async function updatePRBranch(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd([
    "pr",
    "update-branch",
    `${prNumber}`,
    "-R",
    `${owner}/${repo}`,
  ]);
}

/**
 * Review a PR using gh CLI
 */
export async function reviewPR(
  owner: string,
  repo: string,
  prNumber: number,
  action: "approve" | "request-changes" | "comment",
  body?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["pr", "review", `${prNumber}`, "-R", `${owner}/${repo}`];

  if (action === "approve") {
    args.push("--approve");
  } else if (action === "request-changes") {
    args.push("--request-changes");
  } else if (action === "comment") {
    args.push("--comment");
  }

  if (body) {
    args.push("--body", body);
  }

  return ghCmd(args);
}

/**
 * Mark a PR as ready using gh CLI
 */
export async function markPRReady(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["pr", "ready", `${prNumber}`, "-R", `${owner}/${repo}`]);
}

/**
 * Search commits using gh CLI
 */
export async function searchCommits(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHCommitSearchResult[]; total: number }> {
  const result = await ghCmd([
    "search",
    "commits",
    query,
    `--limit=${limit}`,
    "--json=sha,commit,repository,url",
    "--jq",
    '[.[] | {sha, message: .commit.message, repo: ((.repository.fullName // "") | split("/") | .[1] // ""), owner: ((.repository.fullName // "") | split("/") | .[0] // ""), url, committed_date: .commit.committer.date}]',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh search commits failed: ${result.stderr || result.stdout}`,
    );
  }

  let results: GHCommitSearchResult[] = [];
  try {
    results = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Failed to parse gh search commits output: ${result.stdout}`,
    );
  }

  return {
    query,
    results,
    total: results.length,
  };
}

/**
 * List workflows using gh CLI
 */
export async function listWorkflows(
  owner: string,
  repo: string,
  limit = 30,
): Promise<GHWorkflow[]> {
  const args = [
    "workflow",
    "list",
    "-R",
    `${owner}/${repo}`,
    `--limit=${limit}`,
    "--json=name,id,state,path",
  ];

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh workflow list failed: ${result.stderr || result.stdout}`,
    );
  }

  let workflows: GHWorkflow[] = [];
  try {
    workflows = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Failed to parse gh workflow list output: ${result.stdout}`,
    );
  }

  return workflows;
}

/**
 * Run a workflow using gh CLI
 */
export async function runWorkflow(
  owner: string,
  repo: string,
  workflowId: number | string,
  ref?: string,
  inputs?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["workflow", "run", `${workflowId}`, "-R", `${owner}/${repo}`];

  if (ref) {
    args.push("--ref", ref);
  }
  if (inputs) {
    for (const [key, value] of Object.entries(inputs)) {
      args.push("--input", `${key}=${value}`);
    }
  }

  return ghCmd(args);
}

/**
 * List workflow runs using gh CLI
 */
export async function listWorkflowRuns(
  owner: string,
  repo: string,
  workflowId?: number | string,
  limit = 30,
): Promise<GHWorkflowRun[]> {
  const args = ["run", "list", "-R", `${owner}/${repo}`, `--limit=${limit}`];

  if (workflowId) {
    args.push(`--workflow=${workflowId}`);
  }

  args.push(
    "--json=workflowName,status,conclusion,headBranch,headSha,displayTitle,createdAt,url",
    "--jq",
    "[.[] | {workflow_name: .workflowName, status, conclusion, headBranch, headCommit: .headSha, title: .displayTitle, createdAt, url}]",
  );

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    throw new Error(`gh run list failed: ${result.stderr || result.stdout}`);
  }

  let runs: GHWorkflowRun[] = [];
  try {
    runs = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh run list output: ${result.stdout}`);
  }

  return runs;
}

/**
 * View workflow run details using gh CLI
 */
export async function viewWorkflowRun(
  owner: string,
  repo: string,
  runId: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["run", "view", `${runId}`, "-R", `${owner}/${repo}`]);
}

/**
 * Disable a workflow using gh CLI
 */
export async function disableWorkflow(
  owner: string,
  repo: string,
  workflowId: number | string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd([
    "workflow",
    "disable",
    `${workflowId}`,
    "-R",
    `${owner}/${repo}`,
  ]);
}

/**
 * Enable a workflow using gh CLI
 */
export async function enableWorkflow(
  owner: string,
  repo: string,
  workflowId: number | string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd([
    "workflow",
    "enable",
    `${workflowId}`,
    "-R",
    `${owner}/${repo}`,
  ]);
}

/**
 * Create a label in a repository using gh CLI
 */
export async function createLabel(
  owner: string,
  repo: string,
  name: string,
  color: string,
  description?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = [
    "label",
    "create",
    name,
    "-R",
    `${owner}/${repo}`,
    "--color",
    color,
  ];

  if (description) {
    args.push("--description", description);
  }

  return ghCmd(args);
}

/**
 * Delete a label from a repository using gh CLI
 */
export async function deleteLabel(
  owner: string,
  repo: string,
  labelName: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd([
    "label",
    "delete",
    labelName,
    "-R",
    `${owner}/${repo}`,
    "--yes",
  ]);
}

/**
 * Download release assets using gh CLI
 */
export async function downloadRelease(
  owner: string,
  repo: string,
  tag: string,
  pattern?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["release", "download", tag, "-R", `${owner}/${repo}`];

  if (pattern) {
    args.push(pattern);
  }

  return ghCmd(args);
}

/**
 * Delete a release using gh CLI
 */
export async function deleteRelease(
  owner: string,
  repo: string,
  tag: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return ghCmd(["release", "delete", tag, "-R", `${owner}/${repo}`, "--yes"]);
}

/**
 * Create a release using gh CLI
 */
export async function createRelease(
  owner: string,
  repo: string,
  tag: string,
  title?: string,
  draft?: boolean,
  generateNotes?: boolean,
  body?: string,
  assets?: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["release", "create", tag, "-R", `${owner}/${repo}`];

  if (title) {
    args.push("--title", title);
  }
  if (draft) {
    args.push("--draft");
  }
  if (generateNotes) {
    args.push("--generate-notes");
  }
  if (body) {
    args.push("--notes", body);
  }
  if (assets && assets.length > 0) {
    args.push(...assets);
  }

  return ghCmd(args);
}

// Additional type definitions
interface GHPR {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  baseRefName: string;
  headRefName: string;
  author: { login: string; avatar_url: string; html_url: string };
  body: string;
  html_url: string;
  mergeable: string;
  reviewDecision: string;
}

interface GHIssue {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatar_url: string; html_url: string };
  body: string;
  html_url: string;
  labels: { name: string; description: string; color: string }[];
  milestone: { title: string; description: string; dueOn: string } | null;
}

interface GHRelease {
  tagName: string;
  name: string;
  publishedAt: string;
  url: string;
  draft: boolean;
  isPrerelease: boolean;
  assets: {
    name: string;
    url: string;
    size: number;
    downloadCount: number;
  }[];
}

interface GHLabel {
  name: string;
  description: string;
  color: string;
}

interface GHCommitSearchResult {
  sha: string;
  message: string;
  repo: string;
  owner: string;
  url: string;
  committed_date: string;
}

interface GHWorkflow {
  name: string;
  id: number;
  state: string;
  path: string;
}

interface GHWorkflowRun {
  workflow_name: string;
  status: string;
  conclusion: string;
  headBranch: string;
  headCommit: string;
  title: string;
  createdAt: string;
  url: string;
}

interface GHCodeSearchResult {
  repo: string;
  owner: string;
  name: string;
  path: string;
  html_url: string;
  text_matches?: {
    snippet: string;
    matches: { text: string }[];
  }[];
}

interface GHIssueSearchResult {
  number: number;
  title: string;
  state: string;
  repo: string;
  owner: string;
  createdAt: string;
  labels: { name: string }[];
  url: string;
}

interface GHPRSearchResult {
  number: number;
  title: string;
  state: string;
  repo: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  labels: { name: string }[];
  url: string;
  mergeable: string;
}

/**
 * Clone a repository using gh CLI
 */
export async function cloneRepo(
  owner: string,
  repo: string,
  directory?: string,
  _privateRepo = false,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["repo", "clone", `${owner}/${repo}`];
  if (directory) {
    args.push(directory);
  }

  return ghCmd(args);
}

/**
 * Format repository search results
 */
function formatRepoSearchResult(result: SearchResult): string {
  const cols: Column[] = [
    { key: "󰓎", align: "right", minWidth: 6 },
    { key: "󰘬", align: "right", minWidth: 5 },
    {
      key: "repo",
      format: (_v, row) => {
        const r = row as Record<string, string>;
        const lines = [`${r.repo}${r.private === "true" ? "" : ""}`];
        if (r.description) lines.push(r.description);
        const meta: string[] = [];
        if (r.lang) meta.push(r.lang);
        if (meta.length) lines.push(meta.join(" · "));
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rows = result.results.map((repo) => ({
    "󰓎": repo.stargazers_count.toLocaleString(),
    "󰘬": repo.forks_count.toLocaleString(),
    repo: repo.full_name,
    description: repo.description || "",
    lang: repo.language || "",
    url: repo.html_url,
    private: String(repo.private),
  }));

  return [
    dotJoin(countLabel(result.total.toLocaleString(), "repo")),
    "",
    table(cols, rows),
  ].join("\n");
}

/**
 * Format repository contents
 */
function formatRepoContents(
  owner: string,
  repo: string,
  path: string,
  contents: GHFile[],
): string {
  const lines: string[] = [];

  // Sort: directories first, then files, alphabetically
  const sorted = [...contents].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "dir" ? -1 : 1;
  });

  for (const file of sorted) {
    const icon = file.type === "dir" ? "󰉋" : "󰈙";
    const size =
      file.type === "file" ? ` (${file.size.toLocaleString()} bytes)` : "";

    lines.push(`${icon} ${file.name}${size}`);
  }

  return lines.join("\n");
}

/**
 * Format file content
 */
function formatFileContent(result: FileContentResult): string {
  return result.content;
}

/**
 * Format gist results
 */
function formatGist(gist: Gist): string {
  const fields = [
    { label: "url", value: gist.html_url },
    { label: "description", value: gist.description || "No description" },
    { label: "created", value: new Date(gist.created_at).toLocaleString() },
    { label: "updated", value: new Date(gist.updated_at).toLocaleString() },
    {
      label: "visibility",
      value: `${stateDot(gist.public)} public`,
    },
    {
      label: "files",
      value: Object.entries(gist.files)
        .map(
          ([name, f]) =>
            `${name} (${(f.size / 1024).toFixed(1)} KB, ${f.language || "plain text"})`,
        )
        .join(", "),
    },
  ];

  return detail(fields);
}

/**
 * Format gist update result
 */
function formatGistUpdate(gist: Gist): string {
  const lines: string[] = [
    `✓ Gist updated: ${gist.html_url}`,
    gist.description || "No description",
    `Updated: ${new Date(gist.updated_at).toLocaleString()}`,
    "",
    "Files:",
  ];

  for (const [filename, file] of Object.entries(gist.files)) {
    const size = (file.size / 1024).toFixed(1);
    const lang = file.language || "Plain text";
    lines.push(`  • ${filename} (${size} KB, ${lang})`);
  }

  return lines.join("\n");
}

/**
 * Format repo view
 */
function _formatRepoView(repo: GHRepo): string {
  const fields = [
    { label: "name", value: repo.full_name },
    { label: "description", value: repo.description || "No description" },
    { label: "url", value: repo.html_url },
    { label: "stars", value: repo.stargazers_count.toLocaleString() },
    { label: "forks", value: repo.forks_count.toLocaleString() },
    { label: "language", value: repo.language || "Not specified" },
    { label: "branch", value: repo.default_branch },
    { label: "created", value: new Date(repo.created_at).toLocaleDateString() },
    { label: "updated", value: new Date(repo.updated_at).toLocaleDateString() },
    { label: "pushed", value: new Date(repo.pushed_at).toLocaleDateString() },
    { label: "size", value: `${repo.size} KB` },
    ...(repo.homepage ? [{ label: "homepage", value: repo.homepage }] : []),
    ...(repo.private ? [{ label: "visibility", value: "private" }] : []),
    ...(repo.fork ? [{ label: "fork", value: "yes" }] : []),
  ];

  return detail(fields);
}

/**
 * Format code search results
 */
function formatCodeSearchResult(result: {
  query: string;
  results: GHCodeSearchResult[];
  total: number;
}): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 3 },
    {
      key: "path",
      format: (_v, row) => {
        const r = row as Record<string, string>;
        const lines = [r.path];
        if (r.snippet) lines.push(r.snippet);
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rows = result.results.map((item, i) => {
    const snippet = item.text_matches?.[0]?.snippet?.substring(0, 100) ?? "";
    return {
      "#": String(i + 1),
      path: `${item.owner}/${item.repo}/${item.path}`,
      snippet: snippet + (snippet.length >= 100 ? "..." : ""),
      url: item.html_url,
    };
  });

  return [
    dotJoin(countLabel(result.total.toLocaleString(), "result")),
    "",
    table(cols, rows),
  ].join("\n");
}

/**
 * Format issue search results
 */
function formatIssueSearchResult(result: {
  query: string;
  results: GHIssueSearchResult[];
  total: number;
}): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format: (_v, row) => {
        const r = row as Record<string, string>;
        const dot = r.state === "open" ? stateDot("on") : stateDot("off");
        const lines = [`${dot} ${r.title}`];
        lines.push(`${r.repo} · ${r.date}`);
        if (r.labels) lines.push(r.labels);
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rows = result.results.map((issue) => ({
    "#": `#${issue.number}`,
    title: issue.title,
    state: issue.state,
    repo: `${issue.owner}/${issue.repo}`,
    date: new Date(issue.createdAt).toLocaleDateString(),
    labels: issue.labels.map((l) => l.name).join(", "),
    url: issue.url,
  }));

  return [
    dotJoin(`${result.total.toLocaleString()} issues`),
    "",
    table(cols, rows),
  ].join("\n");
}

/**
 * Format PR search results
 */
function formatPRSearchResult(result: {
  query: string;
  results: GHPRSearchResult[];
  total: number;
}): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format: (_v, row) => {
        const r = row as Record<string, string>;
        const dot = r.state === "open" ? stateDot("on") : stateDot("off");
        const merge =
          r.mergeable === "MERGEABLE"
            ? "✓"
            : r.mergeable === "CONFLICTING"
              ? "✗"
              : "?";
        const lines = [`${dot} ${r.title} ${merge}`];
        lines.push(`${r.repo} · ${r.created} – ${r.updated}`);
        if (r.labels) lines.push(r.labels);
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rows = result.results.map((pr) => ({
    "#": `#${pr.number}`,
    title: pr.title,
    state: pr.state,
    mergeable: pr.mergeable,
    repo: `${pr.owner}/${pr.repo}`,
    created: new Date(pr.createdAt).toLocaleDateString(),
    updated: new Date(pr.updatedAt).toLocaleDateString(),
    labels: pr.labels.map((l) => l.name).join(", "),
    url: pr.url,
  }));

  return [
    dotJoin(`${result.total.toLocaleString()} PRs`),
    "",
    table(cols, rows),
  ].join("\n");
}

/**
 * Format repo files list
 */
function formatRepoFilesList(result: {
  files: GHFile[];
  count: number;
  owner: string;
  repo: string;
  path: string;
}): string {
  const cols: Column[] = [
    { key: "type", minWidth: 3 },
    { key: "size", align: "right", minWidth: 8 },
    { key: "name" },
  ];

  const rows = result.files.map((f) => ({
    type: f.type === "dir" ? "󰉋" : "󰈙",
    size: f.type === "file" ? `${f.size.toLocaleString()} B` : "",
    name: f.name,
  }));

  const lines: string[] = [
    dotJoin(`${result.count} files`),
    "",
    table(cols, rows),
  ];

  return lines.join("\n");
}

/**
 * Helper to create error result
 */
function createErrorResult(
  message: string,
): AgentToolResult<{ error?: string }> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
}

// TypeBox parameter schemas
const SearchReposParams = Type.Object({
  query: Type.String({
    description: "Search query (e.g., 'language:typescript stars:>1000')",
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
});

const SearchCodeParams = Type.Object({
  query: Type.String({
    description: "Code search query (e.g., 'function main repo:owner/repo')",
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
});

const SearchIssuesParams = Type.Object({
  query: Type.String({
    description: "Issues search query (e.g., 'is:open label:bug')",
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
});

const SearchPRsParams = Type.Object({
  query: Type.String({
    description: "PRs search query (e.g., 'is:open review:required')",
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
});

const GetRepoContentsParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  path: Type.Optional(
    Type.String({
      description: "Path within repository (default: root)",
    }),
  ),
});

const GetFileContentParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  path: Type.String({
    description: "File path within repository (e.g., 'README.md')",
  }),
  ref: Type.Optional(
    Type.String({
      description: "Branch or commit reference (optional)",
    }),
  ),
});

const ListGistsParams = Type.Object({
  userId: Type.Optional(
    Type.String({
      description:
        "GitHub username (default: authenticated user). Omit to list your own gists.",
    }),
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 30,
      description: "Number of gists to return (max 100)",
    }),
  ),
  since: Type.Optional(
    Type.String({
      description: "Only show gists updated after this date (ISO 8601 format)",
    }),
  ),
});

const GetGistParams = Type.Object({
  gistId: Type.String({
    description: "Gist ID (e.g., 'abc123')",
  }),
});

const CreateGistParams = Type.Object({
  files: Type.Record(
    Type.String(),
    Type.Object({
      content: Type.String({
        description: "File content",
      }),
      filename: Type.Optional(
        Type.String({
          description: "Filename (optional, defaults to key)",
        }),
      ),
    }),
    {
      description: "Dictionary of files to create",
      minProperties: 1,
    },
  ),
  description: Type.Optional(
    Type.String({
      description: "Gist description",
    }),
  ),
  isPublic: Type.Optional(
    Type.Boolean({
      description: "Whether gist is public (default: false)",
      default: false,
    }),
  ),
});

const UpdateGistParams = Type.Object({
  gistId: Type.String({
    description: "Gist ID to update",
  }),
  files: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object({
        content: Type.String({
          description: "Updated file content",
        }),
        filename: Type.Optional(
          Type.String({
            description: "Filename (optional, defaults to key)",
          }),
        ),
      }),
    ),
  ),
  description: Type.Optional(
    Type.String({
      description: "Updated description",
    }),
  ),
});

const ListRepoFilesParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  path: Type.Optional(
    Type.String({
      description: "Path within repository (default: root)",
    }),
  ),
  maxFiles: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 500,
      default: 50,
      description: "Maximum number of files to return (max 500)",
    }),
  ),
});

// Type definitions for new commands
interface GHOrg {
  id: number;
  login: string;
  name: string;
  description: string | null;
  html_url: string;
  avatar_url: string;
}

interface GHAlias {
  name: string;
  expansion: string;
}

interface GHExtension {
  name: string;
  version: string;
}

interface GHGpgKey {
  id: string;
  keyId: string;
  createdAt: string;
}

interface GHSecret {
  name: string;
  updatedAt: string;
}

interface GHSshKey {
  id: string;
  keyId: string;
  title: string;
  createdAt: string;
}

interface GHCache {
  id: number;
  key: string;
  size_in_bytes: number;
  last_accessed_at: string;
}

interface GHVariable {
  name: string;
  value: string;
}

interface GHRuleset {
  id: number;
  name: string;
  source_type: string;
  source: string;
  enforcement: string;
}

interface GHProject {
  id: number;
  number: number;
  title: string;
  state: string;
  url: string;
}

// Type aliases for TypeScript
type SearchReposParamsType = Static<typeof SearchReposParams>;
type SearchCodeParamsType = Static<typeof SearchCodeParams>;
type SearchIssuesParamsType = Static<typeof SearchIssuesParams>;
type SearchPRsParamsType = Static<typeof SearchPRsParams>;
type GetRepoContentsParamsType = Static<typeof GetRepoContentsParams>;
type GetFileContentParamsType = Static<typeof GetFileContentParams>;
type ListGistsParamsType = Static<typeof ListGistsParams>;
type GetGistParamsType = Static<typeof GetGistParams>;
type CreateGistParamsType = Static<typeof CreateGistParams>;
type UpdateGistParamsType = Static<typeof UpdateGistParams>;
type ListRepoFilesParamsType = Static<typeof ListRepoFilesParams>;

export default function ghExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh-search-repos",
    label: "Search Repositories",
    description: `Search for GitHub repositories using gh CLI.

Use this to:
- Find repositories by language, stars, forks
- Search for specific topics or features
- Discover popular or trending projects
- Find repos by owner or organization

Examples:
- gh-search-repos(query='language:typescript stars:>1000')
- gh-search-repos(query='react framework', limit=10)
- gh-search-repos(query='owner:microsoft')`,
    parameters: SearchReposParams,

    async execute(
      _toolCallId,
      params: SearchReposParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await searchRepos(params.query, params.limit);
        const output = formatRepoSearchResult(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-search-repos"));
      if (args.query) {
        text += theme.fg("muted", ` "${args.query}"`);
      }
      if (args.limit) {
        text += theme.fg("dim", ` (limit=${args.limit})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-search-code",
    label: "Search Code",
    description: `Search for code across GitHub repositories using gh CLI.

Use this to:
- Find code snippets across repos
- Search for specific functions or patterns
- Locate TODOs, FIXMEs, or comments
- Find files by content patterns

Examples:
- gh-search-code(query='function main repo:owner/repo')
- gh-search-code(query='import React filename:package.json')
- gh-search-code(query='TODO comment', limit=30)`,
    parameters: SearchCodeParams,

    async execute(
      _toolCallId,
      params: SearchCodeParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await searchCode(params.query, params.limit || 20);
        const output = formatCodeSearchResult(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-search-code"));
      if (args.query) {
        text += theme.fg("muted", ` "${args.query}"`);
      }
      if (args.limit) {
        text += theme.fg("dim", ` (limit=${args.limit})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-search-issues",
    label: "Search Issues",
    description: `Search for issues across GitHub repositories using gh CLI.

Use this to:
- Find open/closed issues
- Search by labels, assignees, authors
- Track bugs and feature requests
- Find issues by state

Examples:
- gh-search-issues(query='is:open label:bug')
- gh-search-issues(query='author:@me is:closed')
- gh-search-issues(query='state:open assigned:@me', limit=50)`,
    parameters: SearchIssuesParams,

    async execute(
      _toolCallId,
      params: SearchIssuesParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await searchIssues(params.query, params.limit || 20);
        const output = formatIssueSearchResult(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-search-issues"));
      if (args.query) {
        text += theme.fg("muted", ` "${args.query}"`);
      }
      if (args.limit) {
        text += theme.fg("dim", ` (limit=${args.limit})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-search-prs",
    label: "Search PRs",
    description: `Search for pull requests across GitHub repositories using gh CLI.

Use this to:
- Find open/merged/closed PRs
- Search by review status, mergeability
- Track PRs by author or status
- Find PRs with specific labels

Examples:
- gh-search-prs(query='is:open review:required')
- gh-search-prs(query='author:@me is:merged')
- gh-search-prs(query='status:success', limit=30)`,
    parameters: SearchPRsParams,

    async execute(
      _toolCallId,
      params: SearchPRsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await searchPRs(params.query, params.limit || 20);
        const output = formatPRSearchResult(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-search-prs"));
      if (args.query) {
        text += theme.fg("muted", ` "${args.query}"`);
      }
      if (args.limit) {
        text += theme.fg("dim", ` (limit=${args.limit})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-repo-contents",
    label: "Repository Contents",
    description: `Browse the contents of a GitHub repository.

Use this to:
- List files and directories in a repo
- Explore project structure
- Navigate through directories
- Find specific files or folders

Examples:
- gh-repo-contents(owner='facebook', repo='react', path='packages')
- gh-repo-contents(owner='microsoft', repo='vscode')`,
    parameters: GetRepoContentsParams,

    async execute(
      _toolCallId,
      params: GetRepoContentsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const contents = await getRepoContents(
          params.owner,
          params.repo,
          params.path || "",
        );
        const output = formatRepoContents(
          params.owner,
          params.repo,
          params.path || "",
          contents,
        );
        return {
          content: [{ type: "text", text: output }],
          details: { contents },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-repo-contents"));
      if (args.owner && args.repo) {
        text += theme.fg("muted", ` (${args.owner}/${args.repo})`);
      }
      if (args.path) {
        text += theme.fg("dim", `/${args.path}`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-file-content",
    label: "File Content",
    description: `Get the content of a specific file from a GitHub repository.

Use this to:
- Read source code files
- View configuration files
- Examine documentation
- Check specific file contents

Examples:
- gh-file-content(owner='facebook', repo='react', path='README.md')
- gh-file-content(owner='microsoft', repo='vscode', path='package.json')
- gh-file-content(owner='pytorch', repo='pytorch', path='setup.py', ref='main')`,
    parameters: GetFileContentParams,

    async execute(
      _toolCallId,
      params: GetFileContentParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await getFileContent(
          params.owner,
          params.repo,
          params.path,
          params.ref,
        );
        const output = formatFileContent(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-file-content"));
      if (args.owner && args.repo && args.path) {
        text += theme.fg("muted", ` (${args.owner}/${args.repo}/${args.path})`);
      }
      if (args.ref) {
        text += theme.fg("dim", ` @${args.ref}`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-list-gists",
    label: "List Gists",
    description: `List GitHub gists.

Use this to:
- View your own gists (requires auth)
- Browse gists by a specific user
- Find recently created or updated gists

Examples:
- gh-list-gists() - List your gists (requires GITHUB_TOKEN)
- gh-list-gists(userId='octocat', limit=10)`,
    parameters: ListGistsParams,

    async execute(
      _toolCallId,
      params: ListGistsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const since = params.since ? new Date(params.since) : undefined;
        const gists = await listGists(params.userId, params.limit, since);

        const lines: string[] = [];

        for (const gist of gists) {
          const files = Object.keys(gist.files).join(", ");
          const date = new Date(gist.created_at).toLocaleDateString();
          lines.push(
            `• **${gist.id}** ${stateDot(gist.public)} public`,
            gist.description || "No description",
            `Files: ${files} | Created: ${date}`,
            gist.html_url,
            "",
          );
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: { gists },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-gists"));
      if (args.userId) {
        text += theme.fg("muted", ` user=${args.userId}`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-get-gist",
    label: "Get Gist",
    description: `Get details of a specific GitHub gist.

Use this to:
- View full content of a gist
- See all files in a gist
- Check gist metadata

Examples:
- gh-get-gist(gistId='abc123')
- gh-get-gist(gistId='0123456789abcdef')`,
    parameters: GetGistParams,

    async execute(
      _toolCallId,
      params: GetGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const gist = await getGist(params.gistId);
        const output = formatGist(gist);
        return {
          content: [{ type: "text", text: output }],
          details: { gist },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-get-gist"));
      if (args.gistId) {
        text += theme.fg("muted", ` ${args.gistId}`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-create-gist",
    label: "Create Gist",
    description: `Create a new GitHub gist.

Use this to:
- Share code snippets
- Create temporary code files
- Save configuration examples
- Collaborate on small code samples

Examples:
- gh-create-gist(files={'test.py': {content: 'print("hello")'}, 'README.md': {content: '# Test'}})
- gh-create-gist(files={'main.ts': {content: 'console.log("hi")'}}, description='My test gist', public=true)`,
    parameters: CreateGistParams,

    async execute(
      _toolCallId,
      params: CreateGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      ctx: ExtensionContext,
    ) {
      const fileNames = Object.keys(params.files || {}).join(", ");
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Create Gist",
        `Files: ${fileNames}${params.description ? `\n${params.description}` : ""}`,
      );
      if (denied) return denied;
      try {
        const gist = await createGist(
          params.files,
          params.description,
          params.isPublic,
        );
        const output = formatGist(gist);
        return {
          content: [{ type: "text", text: output }],
          details: { gist },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-create-gist"));
      const fileCount = Object.keys(args.files || {}).length;
      if (fileCount > 0) {
        text += theme.fg("muted", ` ${fileCount} file(s)`);
      }
      if (args.description) {
        text += theme.fg("dim", ` "${args.description}"`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-update-gist",
    label: "Update Gist",
    description: `Update an existing GitHub gist.

Use this to:
- Modify file contents in a gist
- Update gist description
- Add or remove files from a gist

Examples:
- gh-update-gist(gistId='abc123', files={'test.py': {content: 'updated code'}})
- gh-update-gist(gistId='abc123', description='Updated description')`,
    parameters: UpdateGistParams,

    async execute(
      _toolCallId,
      params: UpdateGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      ctx: ExtensionContext,
    ) {
      const fileNames = params.files
        ? Object.keys(params.files).join(", ")
        : "";
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Update Gist",
        `Update gist ${params.gistId}${fileNames ? `\nFiles: ${fileNames}` : ""}`,
      );
      if (denied) return denied;
      try {
        const gist = await updateGist(
          params.gistId,
          params.files,
          params.description,
        );
        const output = formatGistUpdate(gist);
        return {
          content: [{ type: "text", text: output }],
          details: { gist },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-update-gist"));
      if (args.gistId) {
        text += theme.fg("muted", ` ${args.gistId}`);
      }
      if (args.files) {
        const fileCount = Object.keys(args.files).length;
        text += theme.fg("dim", ` ${fileCount} file(s) updated`);
      }
      if (args.description) {
        text += theme.fg("dim", ` desc="${args.description}"`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-list-repo-files",
    label: "List Repository Files",
    description: `List files in a GitHub repository with a preview of directory contents.

Use this to:
- Quickly see what files exist in a repo
- Get a preview of directory structure
- Find files without browsing the web
- Explore project organization

Examples:
- gh-list-repo-files(owner='facebook', repo='react')
- gh-list-repo-files(owner='microsoft', repo='vscode', path='src', maxFiles=100)`,
    parameters: ListRepoFilesParams,

    async execute(
      _toolCallId,
      params: ListRepoFilesParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await listRepoFiles(
          params.owner,
          params.repo,
          params.path || "",
          params.maxFiles || 50,
        );
        const output = formatRepoFilesList({
          ...result,
          owner: params.owner,
          repo: params.repo,
          path: params.path || "",
        });
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-repo-files"));
      if (args.owner && args.repo) {
        text += theme.fg("muted", ` (${args.owner}/${args.repo})`);
      }
      if (args.path) {
        text += theme.fg("dim", `/${args.path}`);
      }
      if (args.maxFiles) {
        text += theme.fg("dim", ` (max=${args.maxFiles})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  // --- PR tools ---

  const ListPRsParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    state: Type.Optional(
      Type.Union(
        [
          Type.Literal("open"),
          Type.Literal("closed"),
          Type.Literal("merged"),
          Type.Literal("all"),
        ],
        { description: "Filter by state (default: open)" },
      ),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        default: 30,
        description: "Max results",
      }),
    ),
  });

  pi.registerTool({
    name: "gh-list-prs",
    label: "List Pull Requests",
    description: "List pull requests in a GitHub repository.",
    parameters: ListPRsParams,
    async execute(
      _id,
      params: Static<typeof ListPRsParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      _ctx?: ExtensionContext,
    ) {
      try {
        const prs = await listPRs(
          params.owner,
          params.repo,
          params.state,
          params.limit,
        );
        const cols: Column[] = [
          { key: "#", align: "right", minWidth: 5 },
          {
            key: "title",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              const dot = r.state === "OPEN" ? stateDot("on") : stateDot("off");
              return [
                `${dot} ${r.title}`,
                `${r.base} ← ${r.head} · ${r.author} · ${r.date}`,
                r.url,
              ].join("\n");
            },
          },
        ];
        const rows = prs.map((pr) => ({
          "#": `#${pr.number}`,
          title: pr.title,
          state: pr.state,
          base: pr.baseRefName,
          head: pr.headRefName,
          author: pr.author?.login ?? "",
          date: new Date(pr.createdAt).toLocaleDateString(),
          url: pr.html_url,
        }));
        return {
          content: [
            {
              type: "text",
              text: [dotJoin(`${prs.length} PRs`), "", table(cols, rows)].join(
                "\n",
              ),
            },
          ],
          details: { prs },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-prs"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}`);
      if (args.state) text += theme.fg("dim", ` --state=${args.state}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  const ViewPRParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    number: Type.Integer({ description: "PR number" }),
  });

  pi.registerTool({
    name: "gh-view-pr",
    label: "View Pull Request",
    description: "View details of a specific pull request.",
    parameters: ViewPRParams,
    async execute(
      _id,
      params: Static<typeof ViewPRParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      _ctx?: ExtensionContext,
    ) {
      try {
        const pr = await viewPR(params.owner, params.repo, params.number);
        const fields = [
          { label: "title", value: `#${pr.number} ${pr.title}` },
          { label: "state", value: pr.state },
          { label: "author", value: pr.author?.login ?? "unknown" },
          { label: "branch", value: `${pr.baseRefName} ← ${pr.headRefName}` },
          { label: "mergeable", value: pr.mergeable },
          { label: "review", value: pr.reviewDecision || "none" },
          { label: "created", value: new Date(pr.createdAt).toLocaleString() },
          { label: "url", value: pr.html_url },
        ];
        const output = [detail(fields), pr.body ? `\n${pr.body}` : ""].join("");
        return { content: [{ type: "text", text: output }], details: { pr } };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-view-pr"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}#${args.number}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  const CreatePRParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    title: Type.String({ description: "PR title" }),
    body: Type.Optional(Type.String({ description: "PR body (markdown)" })),
    head: Type.Optional(Type.String({ description: "Head branch" })),
    base: Type.Optional(Type.String({ description: "Base branch" })),
    draft: Type.Optional(
      Type.Boolean({ description: "Create as draft", default: false }),
    ),
  });

  pi.registerTool({
    name: "gh-create-pr",
    label: "Create Pull Request",
    description: "Create a new pull request.",
    parameters: CreatePRParams,
    async execute(
      _id,
      params: Static<typeof CreatePRParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      ctx?: ExtensionContext,
    ) {
      if (!ctx) return createErrorResult("Blocked: no context");
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Create PR",
        `"${params.title}" in ${params.owner}/${params.repo}`,
      );
      if (denied) return denied;
      try {
        const result = await createPR(
          params.owner,
          params.repo,
          params.title,
          params.body,
          params.head,
          params.base,
          params.draft,
        );
        if (result.exitCode !== 0)
          return createErrorResult(result.stderr || result.stdout);
        return {
          content: [
            { type: "text", text: `✓ PR created\n${result.stdout.trim()}` },
          ],
          details: { stdout: result.stdout },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-create-pr"));
      if (args.title) text += theme.fg("muted", ` "${args.title}"`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  // --- Issue tools ---

  const ListIssuesParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    state: Type.Optional(
      Type.Union(
        [Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")],
        { description: "Filter by state (default: open)" },
      ),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        default: 30,
        description: "Max results",
      }),
    ),
  });

  pi.registerTool({
    name: "gh-list-issues",
    label: "List Issues",
    description: "List issues in a GitHub repository.",
    parameters: ListIssuesParams,
    async execute(
      _id,
      params: Static<typeof ListIssuesParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      _ctx?: ExtensionContext,
    ) {
      try {
        const issues = await listIssues(
          params.owner,
          params.repo,
          params.state,
          params.limit,
        );
        const cols: Column[] = [
          { key: "#", align: "right", minWidth: 5 },
          {
            key: "title",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              const dot = r.state === "OPEN" ? stateDot("on") : stateDot("off");
              const lines = [`${dot} ${r.title}`];
              if (r.labels) lines.push(r.labels);
              lines.push(`${r.author} · ${r.date}`, r.url);
              return lines.join("\n");
            },
          },
        ];
        const rows = issues.map((issue) => ({
          "#": `#${issue.number}`,
          title: issue.title,
          state: issue.state,
          author: issue.author?.login ?? "",
          date: new Date(issue.createdAt).toLocaleDateString(),
          labels: issue.labels?.map((l) => l.name).join(", ") ?? "",
          url: issue.html_url,
        }));
        return {
          content: [
            {
              type: "text",
              text: [
                dotJoin(`${issues.length} issues`),
                "",
                table(cols, rows),
              ].join("\n"),
            },
          ],
          details: { issues },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-issues"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}`);
      if (args.state) text += theme.fg("dim", ` --state=${args.state}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  const ViewIssueParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    number: Type.Integer({ description: "Issue number" }),
  });

  pi.registerTool({
    name: "gh-view-issue",
    label: "View Issue",
    description: "View details of a specific issue.",
    parameters: ViewIssueParams,
    async execute(
      _id,
      params: Static<typeof ViewIssueParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      _ctx?: ExtensionContext,
    ) {
      try {
        const issue = await viewIssue(params.owner, params.repo, params.number);
        const fields = [
          { label: "title", value: `#${issue.number} ${issue.title}` },
          { label: "state", value: issue.state },
          { label: "author", value: issue.author?.login ?? "unknown" },
          {
            label: "labels",
            value: issue.labels?.map((l) => l.name).join(", ") || "none",
          },
          { label: "milestone", value: issue.milestone?.title || "none" },
          {
            label: "created",
            value: new Date(issue.createdAt).toLocaleString(),
          },
          { label: "url", value: issue.html_url },
        ];
        const output = [
          detail(fields),
          issue.body ? `\n${issue.body}` : "",
        ].join("");
        return {
          content: [{ type: "text", text: output }],
          details: { issue },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-view-issue"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}#${args.number}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  const CreateIssueParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    title: Type.String({ description: "Issue title" }),
    body: Type.Optional(Type.String({ description: "Issue body (markdown)" })),
    labels: Type.Optional(
      Type.Array(Type.String(), { description: "Labels to add" }),
    ),
  });

  pi.registerTool({
    name: "gh-create-issue",
    label: "Create Issue",
    description: "Create a new issue in a repository.",
    parameters: CreateIssueParams,
    async execute(
      _id,
      params: Static<typeof CreateIssueParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      ctx?: ExtensionContext,
    ) {
      if (!ctx) return createErrorResult("Blocked: no context");
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Create Issue",
        `"${params.title}" in ${params.owner}/${params.repo}`,
      );
      if (denied) return denied;
      try {
        const result = await createIssue(
          params.owner,
          params.repo,
          params.title,
          params.body,
          params.labels,
        );
        if (result.exitCode !== 0)
          return createErrorResult(result.stderr || result.stdout);
        return {
          content: [
            { type: "text", text: `✓ Issue created\n${result.stdout.trim()}` },
          ],
          details: { stdout: result.stdout },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-create-issue"));
      if (args.title) text += theme.fg("muted", ` "${args.title}"`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  // --- Release tools ---

  const ListReleasesParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        default: 30,
        description: "Max results",
      }),
    ),
  });

  pi.registerTool({
    name: "gh-list-releases",
    label: "List Releases",
    description: "List releases in a GitHub repository.",
    parameters: ListReleasesParams,
    async execute(
      _id,
      params: Static<typeof ListReleasesParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      _ctx?: ExtensionContext,
    ) {
      try {
        const releases = await listReleases(
          params.owner,
          params.repo,
          params.limit,
        );
        const cols: Column[] = [
          { key: "tag", minWidth: 15 },
          {
            key: "info",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              const flags = [
                r.draft === "true" ? "draft" : "",
                r.prerelease === "true" ? "pre-release" : "",
              ]
                .filter(Boolean)
                .join(", ");
              return [r.name, flags ? `[${flags}]` : "", r.date]
                .filter(Boolean)
                .join(" · ");
            },
          },
        ];
        const rows = releases.map((r) => ({
          tag: r.tagName,
          name: r.name || r.tagName,
          draft: String(r.draft),
          prerelease: String(r.isPrerelease),
          date: r.publishedAt
            ? new Date(r.publishedAt).toLocaleDateString()
            : "",
        }));
        return {
          content: [
            {
              type: "text",
              text: [
                dotJoin(`${releases.length} releases`),
                "",
                table(cols, rows),
              ].join("\n"),
            },
          ],
          details: { releases },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-releases"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  const ViewReleaseParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    tag: Type.String({ description: "Release tag (e.g., 'v1.0.0')" }),
  });

  pi.registerTool({
    name: "gh-view-release",
    label: "View Release",
    description: "View details of a specific release.",
    parameters: ViewReleaseParams,
    async execute(
      _id,
      params: Static<typeof ViewReleaseParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      _ctx?: ExtensionContext,
    ) {
      try {
        const release = await viewRelease(
          params.owner,
          params.repo,
          params.tag,
        );
        const fields = [
          { label: "tag", value: release.tagName },
          { label: "name", value: release.name || release.tagName },
          {
            label: "published",
            value: release.publishedAt
              ? new Date(release.publishedAt).toLocaleString()
              : "unpublished",
          },
          {
            label: "draft",
            value: `${stateDot(release.draft)} draft`,
          },
          {
            label: "prerelease",
            value: `${stateDot(release.isPrerelease)} prerelease`,
          },
          { label: "url", value: release.url ? release.url : "" },
          {
            label: "assets",
            value: release.assets?.length
              ? release.assets
                  .map((a) => `${a.name} (${(a.size / 1024).toFixed(1)} KB)`)
                  .join(", ")
              : "none",
          },
        ];
        return {
          content: [{ type: "text", text: detail(fields) }],
          details: { release },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-view-release"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}@${args.tag}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  // --- Workflow & Run tools ---

  const ListWorkflowsParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        default: 30,
        description: "Max results",
      }),
    ),
  });

  pi.registerTool({
    name: "gh-list-workflows",
    label: "List Workflows",
    description: "List GitHub Actions workflows in a repository.",
    parameters: ListWorkflowsParams,
    async execute(
      _id,
      params: Static<typeof ListWorkflowsParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      _ctx?: ExtensionContext,
    ) {
      try {
        const workflows = await listWorkflows(
          params.owner,
          params.repo,
          params.limit,
        );
        const cols: Column[] = [
          { key: "id", align: "right", minWidth: 8 },
          {
            key: "info",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              const dot =
                r.state === "active" ? stateDot("on") : stateDot("off");
              return [`${dot} ${r.name}`, r.path].join("\n");
            },
          },
        ];
        const rows = workflows.map((w) => ({
          id: String(w.id),
          name: w.name,
          state: w.state,
          path: w.path,
        }));
        return {
          content: [
            {
              type: "text",
              text: [
                dotJoin(`${workflows.length} workflows`),
                "",
                table(cols, rows),
              ].join("\n"),
            },
          ],
          details: { workflows },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-workflows"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  const ListRunsParams = Type.Object({
    owner: Type.String({ description: "Repository owner" }),
    repo: Type.String({ description: "Repository name" }),
    workflow: Type.Optional(
      Type.String({ description: "Filter by workflow ID or filename" }),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        default: 30,
        description: "Max results",
      }),
    ),
  });

  pi.registerTool({
    name: "gh-list-runs",
    label: "List Workflow Runs",
    description: "List recent GitHub Actions workflow runs.",
    parameters: ListRunsParams,
    async execute(
      _id,
      params: Static<typeof ListRunsParams>,
      _signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback,
      _ctx?: ExtensionContext,
    ) {
      try {
        const runs = await listWorkflowRuns(
          params.owner,
          params.repo,
          params.workflow,
          params.limit,
        );
        const cols: Column[] = [
          { key: "status", minWidth: 3 },
          {
            key: "info",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              return [r.title, `${r.workflow} · ${r.branch} · ${r.date}`].join(
                "\n",
              );
            },
          },
        ];
        const rows = runs.map((r) => ({
          status:
            r.conclusion === "success"
              ? "✓"
              : r.conclusion === "failure"
                ? "✗"
                : "●",
          title: r.title,
          workflow: r.workflow_name,
          branch: r.headBranch,
          date: new Date(r.createdAt).toLocaleDateString(),
        }));
        return {
          content: [
            {
              type: "text",
              text: [
                dotJoin(`${runs.length} runs`),
                "",
                table(cols, rows),
              ].join("\n"),
            },
          ],
          details: { runs },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-runs"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}`);
      if (args.workflow) text += theme.fg("dim", ` workflow=${args.workflow}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });
}
