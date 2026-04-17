import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { dotJoin, table, type Column } from "../../shared/renderers";
import { ghCmd, ghCmdJson } from "./utils";
import { createErrorResult, createTextResultRender } from "./shared";

/**
 * Create a renderCall function for repo tools with optional owner/repo/path
 */
function createRepoRenderCall(toolName: string) {
  return (args: Record<string, unknown>, theme: Theme): Text => {
    const t = theme as {
      fg: (c: string, t: string) => string;
      bold: (t: string) => string;
    };
    let text = t.fg("toolTitle", t.bold(toolName));
    const owner = args.owner as string;
    const repo = args.repo as string;
    if (owner && repo) text += t.fg("muted", ` (${owner}/${repo})`);
    const path = args.path as string;
    if (path) text += t.fg("dim", `/${path}`);
    const maxFiles = args.maxFiles as number;
    if (maxFiles) text += t.fg("dim", ` (max=${maxFiles})`);
    return new Text(text, 0, 0);
  };
}

/**
 * Create a successful result with formatted output
 */
function createRepoResult<Details extends Record<string, unknown>>(
  output: string,
  details: Details,
): AgentToolResult<Details> {
  return {
    content: [{ type: "text", text: output }],
    details,
  };
}

/**
 * Create an error result from an error
 */
function createRepoErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return createErrorResult(message);
}

export interface GHFile {
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

export interface FileContentResult extends Record<string, unknown> {
  repo: string;
  path: string;
  content: string;
  type: "file" | "directory";
  size?: number;
}

export async function getRepoContents(
  owner: string,
  repo: string,
  path = "",
): Promise<GHFile[]> {
  const pathArg = path ? `/${path}` : "";
  return ghCmdJson<GHFile[]>(
    [
      "api",
      `/repos/${owner}/${repo}/contents${pathArg}`,
      "--jq",
      "[.[] | {name, path, type, size, url, html_url, download_url: .download_url, sha}]",
    ],
    "api",
  );
}

export async function getFileContent(
  owner: string,
  repo: string,
  filePath: string,
  ref: string | undefined,
): Promise<FileContentResult> {
  let endpoint = `/repos/${owner}/${repo}/contents/${filePath}`;
  if (ref != null && ref.length > 0)
    endpoint += `?ref=${encodeURIComponent(ref)}`;
  const args = ["api", endpoint];

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    if (errorMessage.includes("404") || errorMessage.includes("Not Found"))
      throw new Error(
        `File not found: ${owner}/${repo}/${filePath}${ref ? ` at ref ${ref}` : ""}`,
      );
    throw new Error(errorMessage);
  }

  const data: GHFile = JSON.parse(result.stdout);

  if (!data.content || !data.encoding)
    throw new Error(
      `File is binary or too large to display. File size: ${data.size} bytes`,
    );

  return {
    repo: `${owner}/${repo}`,
    path: filePath,
    content: Buffer.from(data.content, "base64").toString("utf-8"),
    type: data.type === "file" ? "file" : "directory",
    size: data.size,
  };
}

interface ProcessRepoItemOpts {
  item: GHFile;
  owner: string;
  repo: string;
  files: GHFile[];
}

async function processRepoItem({
  item,
  owner,
  repo,
  files,
}: ProcessRepoItemOpts): Promise<void> {
  if (item.type === "file") {
    files.push(item);
    return;
  }

  if (item.type === "dir") {
    try {
      const subContents = await getRepoContents(owner, repo, item.path);
      const subFiles = subContents.filter((c) => c.type === "file").slice(0, 5);
      files.push({
        ...item,
        name: `${item.name}/ (${subFiles.length} files)`,
      });
    } catch {
      files.push(item);
    }
  }
}

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
    await processRepoItem({ item, owner, repo, files });
  }

  return { files, count: files.length };
}

function formatRepoContents(
  owner: string,
  repo: string,
  path: string,
  contents: GHFile[],
): string {
  const lines: string[] = [];

  const sorted = [...contents].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
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

function formatFileContent(result: FileContentResult): string {
  return result.content;
}

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

export const GetRepoContentsParams = Type.Object({
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

export const GetFileContentParams = Type.Object({
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

export const ListRepoFilesParams = Type.Object({
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

export type GetRepoContentsParamsType = Static<typeof GetRepoContentsParams>;
export type GetFileContentParamsType = Static<typeof GetFileContentParams>;
export type ListRepoFilesParamsType = Static<typeof ListRepoFilesParams>;

async function executeGetRepoContents(
  params: GetRepoContentsParamsType,
): Promise<AgentToolResult<{ contents: GHFile[] }>> {
  const owner = params.owner;
  const repo = params.repo;
  const path = params.path;
  const contents = await getRepoContents(owner, repo, path ?? "");
  const output = formatRepoContents(owner, repo, path ?? "", contents);
  return createRepoResult(output, { contents });
}

async function executeGetFileContent(
  params: GetFileContentParamsType,
): Promise<AgentToolResult<FileContentResult>> {
  const owner = params.owner;
  const repo = params.repo;
  const filePath = params.path;
  const ref = params.ref;
  const result = await getFileContent(owner, repo, filePath, ref ?? undefined);
  const output = formatFileContent(result);
  return createRepoResult<FileContentResult>(output, {
    repo: result.repo,
    path: result.path,
    content: result.content,
    type: result.type,
    size: result.size,
  });
}

async function executeListRepoFiles(
  params: ListRepoFilesParamsType,
): Promise<AgentToolResult<{ files: GHFile[]; count: number }>> {
  const owner = params.owner;
  const repo = params.repo;
  const path = params.path;
  const maxFiles = params.maxFiles;
  const result = await listRepoFiles(owner, repo, path ?? "", maxFiles ?? 50);
  const output = formatRepoFilesList({
    ...result,
    owner,
    repo,
    path: path ?? "",
  });
  return createRepoResult(output, result);
}

function createRepoContentsTool() {
  return {
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
      _toolCallId: string,
      params: GetRepoContentsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | ((partialResult: AgentToolResult<Record<string, unknown>>) => void)
        | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        return await executeGetRepoContents(params);
      } catch (error) {
        return createRepoErrorResult(error);
      }
    },

    renderCall: createRepoRenderCall("gh-repo-contents"),
    renderResult: createTextResultRender(),
  };
}

function createFileContentTool() {
  return {
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
      _toolCallId: string,
      params: GetFileContentParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | ((partialResult: AgentToolResult<Record<string, unknown>>) => void)
        | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        return await executeGetFileContent(params);
      } catch (error) {
        return createRepoErrorResult(error);
      }
    },

    renderCall(args: Record<string, unknown>, theme: Theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-file-content"));
      if (args.owner && args.repo && args.path)
        text += theme.fg("muted", ` (${args.owner}/${args.repo}/${args.path})`);
      if (args.ref) text += theme.fg("dim", ` @${args.ref}`);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

function createListRepoFilesTool() {
  return {
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
      _toolCallId: string,
      params: ListRepoFilesParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | ((partialResult: AgentToolResult<Record<string, unknown>>) => void)
        | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        return await executeListRepoFiles(params);
      } catch (error) {
        return createRepoErrorResult(error);
      }
    },

    renderCall: createRepoRenderCall("gh-list-repo-files"),
    renderResult: createTextResultRender(),
  };
}

export function registerRepoTools(pi: ExtensionAPI): void {
  pi.registerTool(createRepoContentsTool());
  pi.registerTool(createFileContentTool());
  pi.registerTool(createListRepoFilesTool());
}
