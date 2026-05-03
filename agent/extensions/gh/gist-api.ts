import { ghCmd, ghCmdJson, ghCmdJsonWithInput } from "./utils";
import { detail } from "../../shared/rendering/detail";
import { stateDot } from "../../shared/rendering/header";

interface GistFile {
  filename: string;
  type: string;
  language: string | null;
  content: string;
  raw_url: string;
  size: number;
}

export interface Gist {
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

export async function listGists(userId?: string, limit = 30): Promise<Gist[]> {
  if (userId && userId !== "@me") {
    const endpoint = `/users/${userId}/gists?per_page=${limit}`;
    return ghCmdJson<Gist[]>(
      [
        "api",
        endpoint,
        "--jq",
        "[.[] | {id, description, public, created_at, updated_at, html_url, files, user: (.owner // null)}]",
      ],
      "api gists",
    );
  }
  const result = await ghCmd(["gist", "list", `--limit=${limit}`]);

  if (result.exitCode !== 0)
    throw new Error(`gh gist list failed: ${result.stderr || result.stdout}`);
  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const gistIds = lines.map((line) => line.split(/\s+/)[0]);
  const gists: Gist[] = [];
  for (const gistId of gistIds) {
    try {
      const gist = await getGist(gistId);
      gists.push(gist);
    } catch (err) {
      console.error(`Failed to fetch gist ${gistId}:`, err);
    }
  }

  return gists;
}

export function getGist(gistId: string): Promise<Gist> {
  return ghCmdJson<Gist>(["api", `/gists/${gistId}`], "api gist");
}

export async function createGist(
  files: Record<string, { content: string; filename?: string }>,
  description = "",
  isPublic = false,
): Promise<Gist> {
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
  if (description) args.push("--desc", description);
  if (isPublic) args.push("--public");
  const result = await ghCmd(args);

  for (const tempFile of fileArgs) {
    try {
      fs.unlinkSync(tempFile);
    } catch (err) {
      console.error(`Failed to remove temp file ${tempFile}:`, err);
    }
  }

  if (result.exitCode !== 0)
    throw new Error(`gh gist create failed: ${result.stderr || result.stdout}`);
  const gistUrl = result.stdout.trim();
  const gistId = gistUrl.split("/").pop();
  if (!gistId)
    throw new Error(`Failed to extract gist ID from output: ${gistUrl}`);

  return getGist(gistId);
}

export function updateGist(
  gistId: string,
  files?: Record<string, { content: string; filename?: string }>,
  description?: string,
): Promise<Gist> {
  const apiBody: Record<string, unknown> = {};
  if (description !== undefined) apiBody.description = description;
  if (files) {
    const apiFiles: Record<string, { content: string; filename?: string }> = {};
    for (const [filename, fileData] of Object.entries(files)) {
      apiFiles[filename] = { content: fileData.content };
      if (fileData.filename) apiFiles[filename].filename = fileData.filename;
    }
    apiBody.files = apiFiles;
  }

  return ghCmdJsonWithInput<Gist>(
    ["api", `/gists/${gistId}`, "-X", "PATCH", "--input", "-"],
    apiBody,
    "api gist update",
  );
}

export function formatGist(gist: Gist): string {
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

export function formatGistUpdate(gist: Gist): string {
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
