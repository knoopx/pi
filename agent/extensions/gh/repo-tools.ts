import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import {
  createErrorResult,
  createTextResultRender,
  TypeBoxFields,
} from "./shared";
import {
  getRepoContents,
  getFileContent,
  listRepoFiles,
  formatRepoContents,
  formatFileContent,
  formatRepoFilesList,
} from "./repo-api";
import type { GHFile, FileContentResult } from "./repo-api";

function createRepoResult<Details extends Record<string, unknown>>(
  output: string,
  details: Details,
): AgentToolResult<Details> {
  return {
    content: [{ type: "text", text: output }],
    details,
  };
}

function createRepoErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return createErrorResult(message);
}

const GetRepoContentsParams = Type.Object({
  owner: TypeBoxFields.owner,
  repo: TypeBoxFields.repoName,
  path: TypeBoxFields.path,
});

const GetFileContentParams = Type.Object({
  owner: TypeBoxFields.owner,
  repo: TypeBoxFields.repoName,
  path: Type.String({
    description: "File path within repository (e.g., 'README.md')",
  }),
  ref: TypeBoxFields.ref,
});

const ListRepoFilesParams = Type.Object({
  owner: TypeBoxFields.owner,
  repo: TypeBoxFields.repoName,
  path: TypeBoxFields.path,
  maxFiles: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 500,
      default: 50,
      description: "Maximum number of files to return (max 500)",
    }),
  ),
});

async function executeGetRepoContents(
  params: Static<typeof GetRepoContentsParams>,
): Promise<AgentToolResult<{ contents: GHFile[] }>> {
  const contents = await getRepoContents(
    params.owner,
    params.repo,
    params.path ?? "",
  );
  const output = formatRepoContents(
    params.owner,
    params.repo,
    params.path ?? "",
    contents,
  );
  return createRepoResult(output, { contents });
}

async function executeGetFileContent(
  params: Static<typeof GetFileContentParams>,
): Promise<AgentToolResult<FileContentResult>> {
  const result = await getFileContent(
    params.owner,
    params.repo,
    params.path,
    params.ref ?? undefined,
  );
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
  params: Static<typeof ListRepoFilesParams>,
): Promise<AgentToolResult<{ files: GHFile[]; count: number }>> {
  const result = await listRepoFiles(
    params.owner,
    params.repo,
    params.path ?? "",
    params.maxFiles ?? 50,
  );
  const output = formatRepoFilesList({
    ...result,
    owner: params.owner,
    repo: params.repo,
    path: params.path ?? "",
  });
  return createRepoResult(output, result);
}

function createRepoRenderCall(toolName: string) {
  return (args: Record<string, unknown>, theme: Theme): Text => {
    let text = theme.fg("toolTitle", theme.bold(toolName));
    const owner = args.owner as string;
    const repo = args.repo as string;
    if (owner && repo) text += theme.fg("muted", ` (${owner}/${repo})`);
    const path = args.path as string;
    if (path) text += theme.fg("dim", `/${path}`);
    const maxFiles = args.maxFiles as number;
    if (maxFiles) text += theme.fg("dim", ` (max=${maxFiles})`);
    return new Text(text, 0, 0);
  };
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
      params: Static<typeof GetRepoContentsParams>,
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
      params: Static<typeof GetFileContentParams>,
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
      const owner = typeof args.owner === "string" ? args.owner : undefined;
      const repo = typeof args.repo === "string" ? args.repo : undefined;
      const path = typeof args.path === "string" ? args.path : undefined;
      if (owner && repo && path)
        text += theme.fg("muted", ` (${owner}/${repo}/${path})`);
      const ref = typeof args.ref === "string" ? args.ref : undefined;
      if (ref) text += theme.fg("dim", ` @${ref}`);
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
      params: Static<typeof ListRepoFilesParams>,
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
