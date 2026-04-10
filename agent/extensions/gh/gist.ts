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
import { detail, stateDot } from "../../shared/renderers";
import { ghCmd } from "./utils";

export interface GistFile {
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

export async function listGists(
  userId?: string,
  limit = 30,
  _since?: Date,
): Promise<Gist[]> {
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

  const result = await ghCmd(["gist", "list", `--limit=${limit}`]);

  if (result.exitCode !== 0) {
    throw new Error(`gh gist list failed: ${result.stderr || result.stdout}`);
  }

  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const gistIds = lines.map((line) => line.split(/\s+/)[0]);

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

export async function getGist(gistId: string): Promise<Gist> {
  const result = await ghCmd(["api", `/gists/${gistId}`]);

  if (result.exitCode !== 0) {
    throw new Error(`gh api gist failed: ${result.stderr || result.stdout}`);
  }

  const gist: Gist = JSON.parse(result.stdout);

  return gist;
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
  if (description) {
    args.push("--desc", description);
  }
  if (isPublic) {
    args.push("--public");
  }

  const result = await ghCmd(args);

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

  const gistUrl = result.stdout.trim();
  const gistId = gistUrl.split("/").pop();
  if (!gistId) {
    throw new Error(`Failed to extract gist ID from output: ${gistUrl}`);
  }

  return getGist(gistId);
}

export async function updateGist(
  gistId: string,
  files?: Record<string, { content: string; filename?: string }>,
  description?: string,
): Promise<Gist> {
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

function createErrorResult(
  message: string,
): AgentToolResult<{ error?: string }> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
}

export const ListGistsParams = Type.Object({
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

export const GetGistParams = Type.Object({
  gistId: Type.String({
    description: "Gist ID (e.g., 'abc123')",
  }),
});

export const CreateGistParams = Type.Object({
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

export const UpdateGistParams = Type.Object({
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

export type ListGistsParamsType = Static<typeof ListGistsParams>;
export type GetGistParamsType = Static<typeof GetGistParams>;
export type CreateGistParamsType = Static<typeof CreateGistParams>;
export type UpdateGistParamsType = Static<typeof UpdateGistParams>;

export function registerGistTools(pi: ExtensionAPI) {
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
    parameters: ListGistsParams as any,

    async execute(
      _toolCallId: string,
      params: ListGistsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
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
      if ((args as ListGistsParamsType).userId) {
        text += theme.fg(
          "muted",
          ` user=${(args as ListGistsParamsType).userId}`,
        );
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
    parameters: GetGistParams as any,

    async execute(
      _toolCallId: string,
      params: GetGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
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
      if ((args as GetGistParamsType).gistId) {
        text += theme.fg("muted", ` ${(args as GetGistParamsType).gistId}`);
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
    parameters: CreateGistParams as any,

    async execute(
      _toolCallId: string,
      params: CreateGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
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
      const a = args as CreateGistParamsType;
      let text = theme.fg("toolTitle", theme.bold("gh-create-gist"));
      const fileCount = Object.keys(a.files || {}).length;
      if (fileCount > 0) {
        text += theme.fg("muted", ` ${fileCount} file(s)`);
      }
      if (a.description) {
        text += theme.fg("dim", ` "${a.description}"`);
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
    parameters: UpdateGistParams as any,

    async execute(
      _toolCallId: string,
      params: UpdateGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
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
}
