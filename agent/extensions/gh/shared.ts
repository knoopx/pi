import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";

// Local type for ToolRenderContext (not exported from SDK)
export interface ToolRenderContext<TState = unknown, TArgs = unknown> {
  args: TArgs;
  toolCallId: string;
  invalidate: () => void;
  lastComponent: Component | undefined;
  state: TState;
  cwd: string;
  executionStarted: boolean;
  argsComplete: boolean;
  isPartial: boolean;
  expanded: boolean;
  setExpanded?: (expanded: boolean) => void;
}
import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { dangerousOperationConfirmation } from "../../shared/tool-utils";
import { renderTextToolResult } from "../../shared/render-utils";
import { detail, table, type Column } from "../../shared/renderers";

/**
 * Common params for GitHub list tools
 */
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

/**
 * Create a standardized error result for GitHub tools
 */
export function createErrorResult<T extends Record<string, unknown>>(
  message: string,
): AgentToolResult<T> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message } as unknown as T,
  };
}

/**
 * Create a renderResult function that uses renderTextToolResult
 */
export function createTextResultRender() {
  return function renderResult(
    result: AgentToolResult<unknown>,
    _options: ToolRenderResultOptions,
    theme: Theme,
    _context: ToolRenderContext<unknown, unknown>,
  ) {
    return renderTextToolResult(result, theme as any);
  };
}

/**
 * Wrap a tool execute handler with error handling
 */
function createToolExecute<T extends Record<string, unknown>>(
  handler: (params: Record<string, unknown>) => Promise<AgentToolResult<T>>,
): (
  _id: string,
  params: Record<string, unknown>,
  _signal: AbortSignal | undefined,
  _onUpdate: ((partialResult: AgentToolResult<T>) => void) | undefined,
  _ctx: ExtensionContext,
) => Promise<AgentToolResult<T>> {
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

/**
 * Options for registering a list tool
 */
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

/**
 * Register a list tool with common pattern
 */
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

/**
 * Options for registering a view tool
 */
interface RegisterViewToolOptions<TItem> {
  toolName: string;
  toolLabel: string;
  toolDescription: string;
  paramsSchema: ReturnType<typeof Type.Object>;
  viewFn: (owner: string, repo: string, number: number) => Promise<TItem>;
  fields: (item: TItem) => { label: string; value: string }[];
  includeBody?: boolean;
}

/**
 * Register a view tool with common pattern
 */
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
    const output = [
      detail(itemFields),
      includeBody && "body" in item
        ? `\n${(item as Record<string, unknown>).body}`
        : "",
    ].join("");
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

/**
 * Create a renderCall function for GitHub list tools
 */
export function createListRenderCall(toolName: string) {
  return function renderCall(args: Record<string, unknown>, theme: Theme) {
    return createGithubRenderCallContent(toolName, args, theme, (a) => {
      let text = "";
      if (a.owner && a.repo) text += theme.fg("muted", ` ${a.owner}/${a.repo}`);
      if (a.state) text += theme.fg("dim", ` --state=${a.state}`);
      return text;
    });
  };
}

/**
 * Create a renderCall function for GitHub view tools
 */
export function createViewRenderCall(toolName: string) {
  return function renderCall(args: Record<string, unknown>, theme: Theme) {
    return createGithubRenderCallContent(toolName, args, theme, (a) => {
      if (a.owner && a.repo)
        return theme.fg("muted", ` ${a.owner}/${a.repo}#${a.number}`);
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

/**
 * Create a renderCall function for GitHub create tools
 */
function createCreateRenderCall(toolName: string) {
  return function renderCall(
    args: unknown,
    theme: Theme,
    _context: ToolRenderContext<unknown, unknown>,
  ) {
    const typedArgs = args as { title?: string };
    let text = theme.fg("toolTitle", theme.bold(toolName));
    if (typedArgs.title) text += theme.fg("muted", ` "${typedArgs.title}"`);
    return new Text(text, 0, 0);
  };
}

/**
 * Options for registering a create tool
 */
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

/**
 * Execute a create tool with confirmation
 */
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

/**
 * Register a create tool with common pattern
 */
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
