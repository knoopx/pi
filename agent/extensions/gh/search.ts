import { createErrorResult } from "./shared";
import type {
  ExtensionAPI,
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Static, TSchema } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { renderTextToolResult } from "../../shared/rendering/render-utils";
import { createSearchReposTool } from "./search-repos";
import { createSearchCodeTool } from "./search-code";
import { createSearchIssuesTool } from "./search-issues";
import { createSearchPRsTool } from "./search-prs";

function formatSearchParamValue(raw: unknown): string | undefined {
  if (Array.isArray(raw)) {
    const strings = raw.filter((v) => typeof v === "string");
    return strings.length ? strings.join(",") : undefined;
  }
  return typeof raw === "string" ? raw : undefined;
}

function createSearchToolRenderer(toolName: string) {
  const FILTER_KEYS = [
    "extension",
    "filename",
    "language",
    "owner",
    "repo",
    "state",
    "label",
  ] as const;

  return {
    renderCall(args: unknown, theme: Theme) {
      const a = args as Record<string, unknown>;
      let text = theme.fg("toolTitle", theme.bold(toolName));
      const query = typeof a.query === "string" ? a.query : undefined;
      if (query) text += theme.fg("muted", ` "${query}"`);
      const limit = typeof a.limit === "number" ? a.limit : undefined;
      if (limit != null) text += theme.fg("dim", ` (limit=${limit})`);
      for (const key of FILTER_KEYS) {
        const val = formatSearchParamValue(a[key]);
        if (val) text += theme.fg("dim", ` ${key}=${val}`);
      }
      return new Text(text, 0, 0);
    },
    renderResult(
      result: unknown,
      _options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      return renderTextToolResult(result as AgentToolResult<unknown>, theme);
    },
  };
}

interface RegisterSearchToolOptions<TParams extends TSchema, TResult> {
  toolName: string;
  toolLabel: string;
  toolDescription: string;
  paramsSchema: TParams;
  searchFn: (params: Static<TParams>) => Promise<TResult>;
  formatFn: (result: TResult) => string;
}

function registerSearchTool<TParams extends TSchema, TResult>(
  pi: ExtensionAPI,
  options: RegisterSearchToolOptions<TParams, TResult>,
) {
  const {
    toolName,
    toolLabel,
    toolDescription,
    paramsSchema,
    searchFn,
    formatFn,
  } = options;

  pi.registerTool({
    name: toolName,
    label: toolLabel,
    description: toolDescription,
    parameters: paramsSchema,

    async execute(
      __toolCallId: string,
      params: Static<TParams>,
      __signal: AbortSignal | undefined,
      __onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      __ctx: ExtensionContext,
    ) {
      return await executeSearchTool(searchFn, formatFn, params);
    },
    ...createSearchToolRenderer(toolName),
  });
}

async function executeSearchTool<TParams extends TSchema, TResult>(
  searchFn: (params: Static<TParams>) => Promise<TResult>,
  formatFn: (result: TResult) => string,
  params: Static<TParams>,
): Promise<AgentToolResult<unknown>> {
  try {
    const result = await searchFn(params);
    const output = formatFn(result);
    return {
      content: [{ type: "text", text: output }],
      details: result,
    };
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function registerSearchTools(pi: ExtensionAPI) {
  registerSearchTool(pi, createSearchReposTool());
  registerSearchTool(pi, createSearchCodeTool());
  registerSearchTool(pi, createSearchIssuesTool());
  registerSearchTool(pi, createSearchPRsTool());
}
