import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { createErrorResult } from "../lib/registration";
import { createTextResultRender } from "../lib/rendering";
import { TypeBoxFields } from "../lib/types";
import {
  getRepoContents,
  getFileContent,
  listRepoFiles,
  formatRepoContents,
  formatFileContent,
  formatRepoFilesList,
} from "../api/repo";
import type { GHFile, FileContentResult } from "../api/repo";

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

function createRepoExecute<P>(
  handler: (params: P) => Promise<AgentToolResult<Record<string, unknown>>>,
) {
  return async (
    _toolCallId: string,
    params: P,
    _signal: AbortSignal | undefined,
    _onUpdate:
      | ((partialResult: AgentToolResult<Record<string, unknown>>) => void)
      | undefined,
    _ctx: ExtensionContext,
  ): Promise<AgentToolResult<Record<string, unknown>>> => {
    try {
      return await handler(params);
    } catch (error) {
      return createRepoErrorResult(error);
    }
  };
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

function formatOwnerRepoPath(
  owner: string | undefined,
  repo: string | undefined,
  path: string | undefined,
  theme: Theme,
): string {
  if (owner && repo && path)
    return theme.fg("muted", ` (${owner}/${repo}/${path})`);
  return "";
}

function formatRepoPathSection(
  args: Record<string, unknown>,
  theme: Theme,
): string {
  let text = "";
  const path = args.path as string;
  if (path) text += theme.fg("dim", `/${path}`);
  const maxFiles = args.maxFiles as number;
  if (maxFiles) text += theme.fg("dim", ` (max=${maxFiles})`);
  return text;
}

function formatRepoCallArgs(
  args: Record<string, unknown>,
  theme: Theme,
): string {
  let text = "";
  const owner = args.owner as string;
  const repo = args.repo as string;
  if (owner && repo) text += theme.fg("muted", ` (${owner}/${repo})`);
  return text + formatRepoPathSection(args, theme);
}

function createRepoRenderCall(toolName: string) {
  return (args: Record<string, unknown>, theme: Theme): Text => {
    const text =
      theme.fg("toolTitle", theme.bold(toolName)) +
      formatRepoCallArgs(args, theme);
    return new Text(text, 0, 0);
  };
}

function createRepoContentsTool() {
  return {
    name: "gh-list-contents",
    label: "Repository Contents",
    description: `Browse the contents of a GitHub repository.`,
    parameters: GetRepoContentsParams,

    execute: createRepoExecute(executeGetRepoContents),

    renderCall: createRepoRenderCall("gh-list-contents"),
    renderResult: createTextResultRender(),
  };
}

function createFileContentTool() {
  return {
    name: "gh-get-file",
    label: "File Content",
    description: `Get the content of a specific file from a GitHub repository.`,
    parameters: GetFileContentParams,

    execute: createRepoExecute(executeGetFileContent),

    renderCall(args: Record<string, unknown>, theme: Theme) {
      const str = (val: unknown): string | undefined =>
        typeof val === "string" ? val : undefined;
      let text = theme.fg("toolTitle", theme.bold("gh-get-file"));
      const owner = str(args.owner);
      const repo = str(args.repo);
      const path = str(args.path);
      text += formatOwnerRepoPath(owner, repo, path, theme);
      const ref = str(args.ref);
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
    description: `List files in a GitHub repository with a preview of directory contents.`,
    parameters: ListRepoFilesParams,

    execute: createRepoExecute(executeListRepoFiles),

    renderCall: createRepoRenderCall("gh-list-repo-files"),
    renderResult: createTextResultRender(),
  };
}

export function registerRepoTools(pi: ExtensionAPI): void {
  pi.registerTool(createRepoContentsTool());
  pi.registerTool(createFileContentTool());
  pi.registerTool(createListRepoFilesTool());
}
