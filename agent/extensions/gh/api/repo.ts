import { ghCmd, ghCmdJson } from "../../../shared/process/gh-cmd";
import { dotJoin } from "../../../shared/rendering/labels";
import { table } from "../../../shared/rendering/table/renderer";
import type { Column } from "../../../shared/rendering/types";

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

export function getRepoContents(
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
  const endpoint = buildContentsEndpoint(owner, repo, filePath, ref);
  const result = await ghCmd(["api", endpoint]);

  if (result.exitCode !== 0)
    throwFileError({ result, owner, repo, filePath, ref });
  const data = JSON.parse(result.stdout) as GHFile;
  ensureDecodable(data);

  return {
    repo: `${owner}/${repo}`,
    path: filePath,
    content: Buffer.from(data.content ?? "", "base64").toString("utf-8"),
    type: data.type === "file" ? "file" : "directory",
    size: data.size,
  };
}

function buildContentsEndpoint(
  owner: string,
  repo: string,
  filePath: string,
  ref: string | undefined,
): string {
  let endpoint = `/repos/${owner}/${repo}/contents/${filePath}`;
  if (ref) endpoint += `?ref=${encodeURIComponent(ref)}`;
  return endpoint;
}

function throwFileError(opts: {
  result: { exitCode: number; stderr: string; stdout: string };
  owner: string;
  repo: string;
  filePath: string;
  ref: string | undefined;
}): never {
  const message = opts.result.stderr || opts.result.stdout || "Unknown error";
  if (isNotFound(message)) {
    throw new Error(
      `File not found: ${opts.owner}/${opts.repo}/${opts.filePath}${opts.ref ? ` at ref ${opts.ref}` : ""}`,
    );
  }
  throw new Error(message);
}

function isNotFound(message: string): boolean {
  return message.includes("404") || message.includes("Not Found");
}

function ensureDecodable(data: GHFile): void {
  if (!data.content || !data.encoding) {
    throw new Error(
      `File is binary or too large to display. File size: ${data.size} bytes`,
    );
  }
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

export function formatRepoContents(
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

export function formatFileContent(result: FileContentResult): string {
  return result.content;
}

export function formatRepoFilesList(result: {
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
