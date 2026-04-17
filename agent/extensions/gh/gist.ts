import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { dangerousOperationConfirmation } from "../../shared/tool-utils";
import { detail, stateDot } from "../../shared/renderers";
import { ghCmd, ghCmdJson, ghCmdJsonWithInput } from "./utils";
import { createErrorResult, createTextResultRender } from "./shared";

/**
 * Create a successful result with formatted gist output
 */
function createGistResult(
  output: string,
  gist: Gist,
): {
  content: { type: "text"; text: string }[];
  details: { gist: Gist };
} {
  return {
    content: [{ type: "text", text: output }],
    details: { gist },
  };
}

/**
 * Create an error result from an error
 */
function createGistErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return createErrorResult(message);
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

async function listGists(
  userId?: string,
  limit = 30,
  _since?: Date,
): Promise<Gist[]> {
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
    } catch {
      // Skip gists that fail to load
    }
  }

  return gists;
}

async function getGist(gistId: string): Promise<Gist> {
  return ghCmdJson<Gist>(["api", `/gists/${gistId}`], "api gist");
}

async function createGist(
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
      // Ignore cleanup errors
      void err;
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

async function updateGist(
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

type ListGistsParamsType = Static<typeof ListGistsParams>;
type GetGistParamsType = Static<typeof GetGistParams>;
type CreateGistParamsType = Static<typeof CreateGistParams>;
type UpdateGistParamsType = Static<typeof UpdateGistParams>;

function createListGistsTool(): Parameters<ExtensionAPI["registerTool"]>[0] {
  return {
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
      _toolCallId: string,
      params: ListGistsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | ((partialResult: AgentToolResult<{ gists: Gist[] }>) => void)
        | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        return await executeListGists(params);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args: unknown, theme: Theme, _context: unknown) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold("gh-list-gists"));
      if (a.userId) text += theme.fg("muted", ` user=${a.userId}`);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

function createGetGistTool(): Parameters<ExtensionAPI["registerTool"]>[0] {
  return {
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
      _toolCallId: string,
      params: GetGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | ((partialResult: AgentToolResult<{ gist: Gist }>) => void)
        | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const gist = await getGist(params.gistId);
        const output = formatGist(gist);
        return createGistResult(output, gist);
      } catch (error) {
        return createGistErrorResult(error);
      }
    },

    renderCall(args: unknown, theme: Theme, _context: unknown) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold("gh-get-gist"));
      if (a.gistId) text += theme.fg("muted", ` ${a.gistId}`);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

function createCreateGistTool(): Parameters<ExtensionAPI["registerTool"]>[0] {
  return {
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
- gh-create-gist(files={'main.ts': {content: 'consoleLog("hi")'}}, description='My test gist', public=true)`,
    parameters: CreateGistParams,

    async execute(
      _toolCallId: string,
      params: CreateGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | ((partialResult: AgentToolResult<{ gist: Gist }>) => void)
        | undefined,
      ctx: ExtensionContext,
    ) {
      const fileNames = Object.keys(params.files || {}).join(", ");
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Create Gist",
        `Files: ${fileNames}${params.description ? `\n${params.description}` : ""}`,
      );
      if (denied) return denied;
      return await executeCreateGist(params);
    },

    renderCall(args: unknown, theme: Theme, _context: unknown) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold("gh-create-gist"));
      const fileCount = Object.keys(a.files || {}).length;
      if (fileCount > 0) text += theme.fg("muted", ` ${fileCount} file(s)`);
      if (a.description) text += theme.fg("dim", ` "${a.description}"`);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

async function executeListGists(
  params: ListGistsParamsType,
): Promise<AgentToolResult<{ gists: Gist[] }>> {
  const since = params.since ? new Date(params.since) : undefined;
  const userId = params.userId;
  const limit = params.limit;
  const gists = await listGists(userId, limit, since);

  const lines = gists
    .map((gist) => [
      `• **${gist.id}** ${stateDot(gist.public)} public`,
      gist.description || "No description",
      `Files: ${Object.keys(gist.files).join(", ")} | Created: ${new Date(
        gist.created_at,
      ).toLocaleDateString()}`,
      gist.html_url,
      "",
    ])
    .flat();

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: { gists },
  };
}

async function executeCreateGist(
  params: CreateGistParamsType,
): Promise<AgentToolResult<{ gist: Gist }>> {
  const files = params.files as Record<
    string,
    { content: string; filename?: string }
  >;
  const description = params.description;
  const isPublic = params.isPublic;
  const gist = await createGist(files, description, isPublic);
  const output = formatGist(gist);
  return createGistResult(output, gist);
}

async function executeUpdateGist(
  params: UpdateGistParamsType,
): Promise<AgentToolResult<{ gist: Gist }>> {
  const gistId = params.gistId;
  const files = params.files as
    | Record<string, { content: string; filename?: string }>
    | undefined;
  const description = params.description;
  const gist = await updateGist(gistId, files, description);
  const output = formatGistUpdate(gist);
  return createGistResult(output, gist);
}

function createUpdateGistTool(): Parameters<ExtensionAPI["registerTool"]>[0] {
  return {
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
      _toolCallId: string,
      params: UpdateGistParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | ((partialResult: AgentToolResult<{ gist: Gist }>) => void)
        | undefined,
      ctx: ExtensionContext,
    ) {
      const fileNames = params.files
        ? Object.keys(params.files).join(", ")
        : "";
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Update Gist",
        "Update gist " +
          params.gistId +
          (fileNames ? "\nFiles: " + fileNames : ""),
      );
      if (denied) return denied;
      return await executeUpdateGist(params);
    },

    renderCall(args: unknown, theme: Theme, _context: unknown) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold("gh-update-gist"));
      if (a.gistId) text += theme.fg("muted", ` ${a.gistId}`);
      if (a.files) {
        const fileCount = Object.keys(a.files).length;
        text += theme.fg("dim", ` ${fileCount} file(s) updated`);
      }
      if (a.description) text += theme.fg("dim", ` desc="${a.description}"`);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

export function registerGistTools(pi: ExtensionAPI) {
  pi.registerTool(createListGistsTool());
  pi.registerTool(createGetGistTool());
  pi.registerTool(createCreateGistTool());
  pi.registerTool(createUpdateGistTool());
}
