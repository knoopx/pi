import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { dangerousOperationConfirmation } from "../../../shared/result/tool";
import { createErrorResult } from "../lib/registration";
import { createTextResultRender } from "../lib/rendering";
import {
  listGists,
  getGist,
  createGist,
  updateGist,
  formatGist,
  formatGistUpdate,
} from "../api/gist";
import type { Gist } from "../api/gist";

function createGistResult(
  output: string,
  gist: Gist,
): AgentToolResult<{ gist: Gist }> {
  return {
    content: [{ type: "text", text: output }],
    details: { gist },
  };
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

async function executeListGists(
  params: Static<typeof ListGistsParams>,
): Promise<AgentToolResult<{ gists: Gist[] }>> {
  const userId = params.userId;
  const limit = params.limit;
  const gists = await listGists(userId, limit);
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
  params: Static<typeof CreateGistParams>,
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
  params: Static<typeof UpdateGistParams>,
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

import { stateDot } from "../../../shared/rendering/labels";

function createListGistsTool(): Parameters<ExtensionAPI["registerTool"]>[0] {
  return {
    name: "gh-list-gists",
    label: "List Gists",
    description: `List GitHub gists.`,
    parameters: ListGistsParams,

    async execute(
      _toolCallId: string,
      params: Static<typeof ListGistsParams>,
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

    renderCall(args: unknown, theme: Theme) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold("gh-list-gists"));
      const userId = typeof a.userId === "string" ? a.userId : undefined;
      if (userId) text += theme.fg("muted", ` user=${userId}`);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

function createGetGistTool(): Parameters<ExtensionAPI["registerTool"]>[0] {
  return {
    name: "gh-get-gist",
    label: "Get Gist",
    description: `Get details of a specific GitHub gist.`,
    parameters: GetGistParams,

    async execute(
      _toolCallId: string,
      params: Static<typeof GetGistParams>,
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
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },

    renderCall(args: unknown, theme: Theme) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold("gh-get-gist"));
      const gistId = typeof a.gistId === "string" ? a.gistId : undefined;
      if (gistId) text += theme.fg("muted", ` ${gistId}`);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

function extractGistDescription(
  a: Record<string, unknown>,
): string | undefined {
  return typeof a.description === "string" ? a.description : undefined;
}

function createCreateGistTool(): Parameters<ExtensionAPI["registerTool"]>[0] {
  return {
    name: "gh-create-gist",
    label: "Create Gist",
    description: `Create a new GitHub gist.`,
    parameters: CreateGistParams,

    async execute(
      _toolCallId: string,
      params: Static<typeof CreateGistParams>,
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

    renderCall(args: unknown, theme: Theme) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold("gh-create-gist"));
      const fileCount = Object.keys(a.files || {}).length;
      if (fileCount > 0) text += theme.fg("muted", ` ${fileCount} file(s)`);
      const description = extractGistDescription(a);
      if (description) text += theme.fg("dim", ` "${description}"`);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

function createUpdateGistTool(): Parameters<ExtensionAPI["registerTool"]>[0] {
  return {
    name: "gh-update-gist",
    label: "Update Gist",
    description: `Update an existing GitHub gist.`,
    parameters: UpdateGistParams,

    async execute(
      _toolCallId: string,
      params: Static<typeof UpdateGistParams>,
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

    renderCall(args: unknown, theme: Theme) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold("gh-update-gist"));
      text += renderGistId(a, theme);
      text += renderGistFiles(a, theme);
      text += renderGistDescription(a, theme);
      return new Text(text, 0, 0);
    },

    renderResult: createTextResultRender(),
  };
}

function renderGistId(a: Record<string, unknown>, theme: Theme): string {
  const gistId = typeof a.gistId === "string" ? a.gistId : undefined;
  return gistId ? theme.fg("muted", ` ${gistId}`) : "";
}

function renderGistFiles(a: Record<string, unknown>, theme: Theme): string {
  if (!a.files) return "";
  const fileCount = Object.keys(a.files as Record<string, unknown>).length;
  return theme.fg("dim", ` ${fileCount} file(s) updated`);
}

function renderGistDescription(
  a: Record<string, unknown>,
  theme: Theme,
): string {
  const description =
    typeof a.description === "string" ? a.description : undefined;
  return description ? theme.fg("dim", ` desc="${description}"`) : "";
}

export function registerGistTools(pi: ExtensionAPI) {
  pi.registerTool(createListGistsTool());
  pi.registerTool(createGetGistTool());
  pi.registerTool(createCreateGistTool());
  pi.registerTool(createUpdateGistTool());
}
