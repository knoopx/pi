import type {
  ExtensionAPI,
  OnUpdate,
  ToolContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINTS: {
    CONTEXT: "/mcp",
    SEARCH: "/mcp",
  },
  DEFAULT_NUM_RESULTS: 8,
} as const;

interface McpResponse {
  jsonrpc: string;
  result: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
}

type TextContent = { type: "text"; text: string };

async function makeMcpCall(
  methodName: string,
  args: Record<string, any>,
  onUpdate: ((update: any) => void) | undefined,
  onUpdateText: string,
  signal?: AbortSignal,
  timeout: number = 30000,
): Promise<AgentToolResult<unknown> & { details: { query: string } }> {
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: methodName,
      arguments: args,
    },
  };

  onUpdate?.({ content: [{ type: "text", text: onUpdateText }] });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const combinedSignal = signal
    ? AbortSignal.any([controller.signal, signal])
    : controller.signal;

  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTEXT}`,
      {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
        signal: combinedSignal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request error (${response.status}): ${errorText}`);
    }

    const responseText = await response.text();
    const lines = responseText.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data: McpResponse = JSON.parse(line.substring(6));
          if (data.result?.content?.[0]?.text) {
            return {
              content: [{ type: "text", text: data.result.content[0].text }],
              details: { query: args.query },
            } as AgentToolResult<unknown> & { details: { query: string } };
          }
        } catch (e) {
          // Ignore invalid JSON lines
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: "No results found. Please try a different query.",
        },
      ],
      details: { query: args.query },
    } as AgentToolResult<unknown> & { details: { query: string } };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "search-code",
    label: "Search Code",
    description: `Find relevant code examples, documentation, and API references.

Use this to:
- Get code snippets for libraries and frameworks
- Understand API usage patterns
- Find implementation examples for specific tasks
- Learn best practices from real code

Provides high-quality, up-to-date programming context.`,
    parameters: Type.Object({
      query: Type.String({
        description:
          "Search query to find relevant context for APIs, Libraries, and SDKs. For example, 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware', 'Next js partial prerendering configuration'",
      }),
      tokensNum: Type.Optional(
        Type.Number({
          minimum: 1000,
          maximum: 50000,
          default: 5000,
          description:
            "Number of tokens to return (1000-50000). Default is 5000 tokens. Adjust this value based on how much context you need.",
        }),
      ),
    }),
    async execute(
      toolCallId: string,
      params: any,
      onUpdate: OnUpdate,
      ctx: ToolContext,
      signal?: AbortSignal,
    ) {
      return makeMcpCall(
        "get_code_context_exa",
        {
          query: params.query,
          tokensNum: params.tokensNum || 5000,
        },
        onUpdate,
        `Searching for code: ${params.query}...`,
        signal,
        30000,
      );
    },
  });

  pi.registerTool({
    name: "search-web",
    label: "Search Web",
    description: `Perform real-time web searches and content scraping.

Use this to:
- Find current information and recent updates
- Research topics across the internet
- Get fresh data for analysis
- Access content from specific websites

Supports live crawling and different search depths.`,
    parameters: Type.Object({
      query: Type.String({ description: "Websearch query" }),
      numResults: Type.Optional(
        Type.Number({
          description: "Number of search results to return (default: 8)",
        }),
      ),
      livecrawl: Type.Optional(
        StringEnum(["fallback", "preferred"] as const, {
          description:
            "Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')",
        }),
      ),
      type: Type.Optional(
        StringEnum(["auto", "fast", "deep"] as const, {
          description:
            "Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search",
        }),
      ),
      contextMaxCharacters: Type.Optional(
        Type.Number({
          description:
            "Maximum characters for context string optimized for LLMs (default: 10000)",
        }),
      ),
    }),
    async execute(
      toolCallId: string,
      params: any,
      onUpdate: OnUpdate,
      ctx: ToolContext,
      signal?: AbortSignal,
    ) {
      return makeMcpCall(
        "web_search_exa",
        {
          query: params.query,
          type: params.type || "auto",
          numResults: params.numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
          livecrawl: params.livecrawl || "fallback",
          contextMaxCharacters: params.contextMaxCharacters,
        },
        onUpdate,
        `Searching the web for: ${params.query}...`,
        signal,
        25000,
      );
    },
  });
}
