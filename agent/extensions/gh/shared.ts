import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";

import { Type } from "@sinclair/typebox";
import type { Static, TSchema } from "@sinclair/typebox";
import { detail } from "../../shared/renderers/detail";
import { table } from "../../shared/renderers/table/renderer";
import type { Column } from "../../shared/renderers/types";
import { Text } from "@mariozechner/pi-tui";
import { dangerousOperationConfirmation } from "../../shared/tool-utils";
import { renderTextToolResult } from "../../shared/render-utils";
export const TypeBoxFields = {
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repoName: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  path: Type.Optional(
    Type.String({
      description: "Path within repository (default: root)",
    }),
  ),
  ref: Type.Optional(
    Type.String({
      description: "Branch or commit reference (optional)",
    }),
  ),
  searchQuery: Type.String({
    description: "Search query keywords",
  }),
  searchLimit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
  listLimit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 30,
      description: "Maximum number of items to return (max 100)",
    }),
  ),
  ownerFilter: Type.Optional(
    Type.Array(Type.String(), {
      description: "Filter on owner",
    }),
  ),
  repoFilter: Type.Optional(
    Type.Array(Type.String(), {
      description: "Filter on repository",
    }),
  ),
  stateFilter: Type.Optional(
    Type.Union([Type.Literal("open"), Type.Literal("closed")], {
      description: "Filter based on state",
    }),
  ),
  labelFilter: Type.Optional(
    Type.Array(Type.String(), {
      description: "Filter on label",
    }),
  ),
  authorFilter: Type.Optional(
    Type.String({
      description: "Filter by author",
    }),
  ),
  assigneeFilter: Type.Optional(
    Type.String({
      description: "Filter by assignee",
    }),
  ),
  viewNumber: Type.Integer({
    description: "Item number (e.g., 123)",
  }),
};
export const ViewParamsSchema = Type.Object({
  owner: TypeBoxFields.owner,
  repo: TypeBoxFields.repoName,
  number: TypeBoxFields.viewNumber,
});
export function createBasicColumns(
  titleFormatter: (r: Record<string, string>) => string,
): Column[] {
  return [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format(_v: unknown, row: Record<string, unknown>) {
        const r = row as Record<string, string>;
        const dot = r.state === "OPEN" ? "●" : "○";
        return `${dot} ${r.title}\n${titleFormatter(r)}`;
      },
    },
  ];
}
export function createListParamsSchema(
  description: string,
  stateValues: string[],
  itemLabel: string,
): ReturnType<typeof Type.Object> {
  return Type.Object({
    owner: Type.String({
      description: "Repository owner (e.g., 'facebook')",
    }),
    repo: Type.String({
      description: "Repository name (e.g., 'react')",
    }),
    state: Type.Optional(
      Type.Union(
        stateValues.map((v) => Type.Literal(v)),
        {
          description: "Filter by state (default: open)",
        },
      ),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        default: 30,
        description: `Maximum number of ${itemLabel} to return (max 100)`,
      }),
    ),
  });
}
export function createErrorResult<T extends Record<string, unknown>>(
  message: string,
): AgentToolResult<T> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message } as unknown as T,
  };
}
export function pushArrayFlag(
  args: string[],
  values: string[] | undefined,
  flagName: string,
): void {
  if (values) {
    for (const v of values) args.push(`--${flagName}=${v}`);
  }
}
export function buildFilterArgs(
  command: string,
  limit: number,
  query?: string,
  owner?: string[],
  repo?: string[],
  state?: "open" | "closed",
  label?: string[],
  author?: string,
  assignee?: string,
): string[] {
  const args: string[] = ["search", command, `--limit=${limit}`];

  if (query) args.push(query);
  pushArrayFlag(args, owner, "owner");
  pushArrayFlag(args, repo, "repo");
  if (state) args.push(`--state=${state}`);
  pushArrayFlag(args, label, "label");
  if (author) args.push(`--author=${author}`);
  if (assignee) args.push(`--assignee=${assignee}`);

  return args;
}
export function createTextResultRender() {
  return function renderResult(
    result: AgentToolResult<unknown>,
    _options: ToolRenderResultOptions,
    theme: Theme,
  ) {
    return renderTextToolResult(result, theme);
  };
}
type ToolExecuteFn = (
  id: string,
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onUpdate:
    | ((partialResult: AgentToolResult<Record<string, unknown>>) => void)
    | undefined,
  ctx: ExtensionContext,
) => Promise<AgentToolResult<Record<string, unknown>>>;
function createToolExecute<T extends Record<string, unknown>>(
  handler: (params: Record<string, unknown>) => Promise<AgentToolResult<T>>,
): ToolExecuteFn {
  return async (
    _id: string,
    params: Record<string, unknown>,
  ): Promise<AgentToolResult<T>> => {
    try {
      return await handler(params);
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error.message : String(error),
      );
    }
  };
}
interface RegisterListToolOptions<TItem> {
  toolName: string;
  toolLabel: string;
  toolDescription: string;
  paramsSchema: ReturnType<typeof Type.Object>;
  listFn: (
    owner: string,
    repo: string,
    state?: "open" | "closed" | "merged" | "all",
    limit?: number,
  ) => Promise<TItem[]>;
  columns: Column[];
  rowMapper: (item: TItem) => Record<string, unknown>;
}
export function registerListTool<TItem>(
  pi: ExtensionAPI,
  options: RegisterListToolOptions<TItem>,
) {
  const {
    toolName,
    toolLabel,
    toolDescription,
    paramsSchema,
    listFn,
    columns,
    rowMapper,
  } = options;
  const executeHandler = createToolExecute(async (params) => {
    const state = params.state as
      | "open"
      | "closed"
      | "merged"
      | "all"
      | undefined;
    const items = await listFn(
      params.owner as string,
      params.repo as string,
      state,
      params.limit as number | undefined,
    );
    const rows = items.map(rowMapper);
    const output = [
      `${items.length} ${toolLabel.toLowerCase()}`,
      "",
      table(columns, rows),
    ].join("\n");
    return {
      content: [{ type: "text", text: output }],
      details: { [toolName.replace("gh-", "")]: items },
    };
  });

  pi.registerTool({
    name: toolName,
    label: toolLabel,
    description: toolDescription,
    parameters: paramsSchema,
    execute: executeHandler,
    renderCall: createListRenderCall(toolName),
    renderResult: createTextResultRender(),
  });
}
interface RegisterViewToolOptions<TItem> {
  toolName: string;
  toolLabel: string;
  toolDescription: string;
  paramsSchema: ReturnType<typeof Type.Object>;
  viewFn: (owner: string, repo: string, number: number) => Promise<TItem>;
  fields: (item: TItem) => { label: string; value: string }[];
  includeBody?: boolean;
}
export function registerViewTool<TItem>(
  pi: ExtensionAPI,
  options: RegisterViewToolOptions<TItem>,
) {
  const {
    toolName,
    toolLabel,
    toolDescription,
    paramsSchema,
    viewFn,
    fields,
    includeBody = true,
  } = options;
  const executeHandler = createToolExecute(async (params) => {
    const item = await viewFn(
      params.owner as string,
      params.repo as string,
      params.number as number,
    );
    if (!item || typeof item !== "object")
      throw new Error(`Invalid response from ${toolName}`);
    const itemFields = fields(item);
    const bodyValue =
      includeBody && "body" in item
        ? (item as Record<string, unknown>).body
        : undefined;
    const bodyStr = typeof bodyValue === "string" ? `\n${bodyValue}` : "";
    const output = [detail(itemFields), bodyStr].filter(Boolean).join("");
    return {
      content: [{ type: "text", text: output }],
      details: { [toolName.replace("gh-", "")]: item },
    };
  });

  pi.registerTool({
    name: toolName,
    label: toolLabel,
    description: toolDescription,
    parameters: paramsSchema,
    execute: executeHandler,
    renderCall: createViewRenderCall(toolName),
    renderResult: createTextResultRender(),
  });
}
export function createListRenderCall(toolName: string) {
  return function renderCall(args: Record<string, unknown>, theme: Theme) {
    return createGithubRenderCallContent(toolName, args, theme, (a) => {
      let text = "";
      const owner = typeof a.owner === "string" ? a.owner : undefined;
      const repo = typeof a.repo === "string" ? a.repo : undefined;
      if (owner && repo) text += theme.fg("muted", ` ${owner}/${repo}`);
      const state = typeof a.state === "string" ? a.state : undefined;
      if (state) text += theme.fg("dim", ` --state=${state}`);
      return text;
    });
  };
}
export function createViewRenderCall(toolName: string) {
  return function renderCall(args: Record<string, unknown>, theme: Theme) {
    return createGithubRenderCallContent(toolName, args, theme, (a) => {
      const owner = typeof a.owner === "string" ? a.owner : undefined;
      const repo = typeof a.repo === "string" ? a.repo : undefined;
      const number =
        typeof a.number === "number" || typeof a.number === "string"
          ? String(a.number)
          : undefined;
      if (owner && repo && number)
        return theme.fg("muted", ` ${owner}/${repo}#${number}`);
      return "";
    });
  };
}
function createGithubRenderCallContent(
  toolName: string,
  args: Record<string, unknown>,
  theme: Theme,
  formatArgs: (args: Record<string, unknown>, theme: Theme) => string,
) {
  const text =
    theme.fg("toolTitle", theme.bold(toolName)) + formatArgs(args, theme);
  return new Text(text, 0, 0);
}
function createCreateRenderCall(toolName: string) {
  return function renderCall(args: unknown, theme: Theme) {
    const typedArgs = args as { title?: string };
    let text = theme.fg("toolTitle", theme.bold(toolName));
    if (typedArgs.title)
      text += theme.fg("muted", ` "${String(typedArgs.title)}"`);
    return new Text(text, 0, 0);
  };
}
interface RegisterCreateToolOptions<TParams extends TSchema> {
  toolName: string;
  toolLabel: string;
  toolDescription: string;
  paramsSchema: TParams;
  createFn: (params: Static<TParams>) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
  confirmationTitle: string;
  confirmationDescription: (params: Static<TParams>) => string;
  successMessagePrefix: string;
}

async function executeCreateTool<TParams extends TSchema>(
  ctx: ExtensionContext,
  params: Static<TParams>,
  options: RegisterCreateToolOptions<TParams>,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const {
    confirmationTitle,
    confirmationDescription,
    createFn,
    successMessagePrefix,
  } = options;

  if (!ctx) return createErrorResult("Blocked: no context");
  const denied = await dangerousOperationConfirmation(
    ctx,
    confirmationTitle,
    confirmationDescription(params),
  );
  if (denied) return denied;
  try {
    const result = await createFn(params);
    if (result.exitCode !== 0)
      return createErrorResult(result.stderr || result.stdout);
    return {
      content: [
        {
          type: "text",
          text: `${successMessagePrefix}\n${result.stdout.trim()}`,
        },
      ],
      details: { stdout: result.stdout },
    };
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : String(error),
    );
  }
}
export function registerCreateTool<TParams extends TSchema>(
  pi: ExtensionAPI,
  options: RegisterCreateToolOptions<TParams>,
) {
  const { toolName, toolLabel, toolDescription, paramsSchema } = options;

  pi.registerTool({
    name: toolName,
    label: toolLabel,
    description: toolDescription,
    parameters: paramsSchema,

    async execute(
      _id: string,
      params: Static<TParams>,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | ((partialResult: AgentToolResult<Record<string, unknown>>) => void)
        | undefined,
      ctx: ExtensionContext,
    ) {
      return await executeCreateTool(ctx, params, options);
    },
    renderCall: createCreateRenderCall(toolName),
    renderResult: createTextResultRender(),
  });
}
