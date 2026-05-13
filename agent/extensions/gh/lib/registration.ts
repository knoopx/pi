import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
} from "@earendil-works/pi-coding-agent";
import type { Static, TSchema } from "typebox";
import { table } from "../../../shared/rendering/table/renderer";
import { detail } from "../../../shared/rendering/detail";
import type { Column } from "../../../shared/rendering/types";
import { dangerousOperationConfirmation } from "../../../shared/result/tool";
import {
  createTextResultRender,
  createListRenderCall,
  createViewRenderCall,
  createCreateRenderCall,
} from "./rendering";

export function createErrorResult<T extends { error?: string }>(
  message: string,
): AgentToolResult<T> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message } as T,
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
  paramsSchema: ReturnType<typeof import("typebox").Type.Object>;
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
  paramsSchema: ReturnType<typeof import("typebox").Type.Object>;
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
