import type { ExtensionAPI, AgentToolResult } from "@earendil-works/pi-coding-agent";
import {
  searchRepos,
  formatRepoSearchResult,
  SearchReposParams,
} from "./repos";
import { searchCode, formatCodeSearchResult, SearchCodeParams } from "./code";
import {
  searchIssues,
  formatIssueSearchResult,
  SearchParamsSchema,
} from "./issues";
import { searchPRs, formatPRSearchResult } from "./prs";

function createErrorResult(message: string): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
}

async function executeSearch<TParams, TResult>(
  searchFn: (params: TParams) => Promise<TResult>,
  formatFn: (result: TResult) => string,
  params: TParams,
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

export function registerGithubSearchTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "gh-search-repos",
    label: "Search Repositories",
    description: `Search for GitHub repositories using gh CLI.`,
    parameters: SearchReposParams,

    async execute(_toolCallId, params) {
      return executeSearch(searchRepos, formatRepoSearchResult, params);
    },
  });

  pi.registerTool({
    name: "gh-search-code",
    label: "Search Code",
    description: `Search for code across GitHub repositories using gh CLI.`,
    parameters: SearchCodeParams,

    async execute(_toolCallId, params) {
      return executeSearch(searchCode, formatCodeSearchResult, params);
    },
  });

  pi.registerTool({
    name: "gh-search-issues",
    label: "Search Issues",
    description: `Search for issues across GitHub repositories using gh CLI.`,
    parameters: SearchParamsSchema,

    async execute(_toolCallId, params) {
      return executeSearch(searchIssues, formatIssueSearchResult, params);
    },
  });

  pi.registerTool({
    name: "gh-search-prs",
    label: "Search PRs",
    description: `Search for pull requests across GitHub repositories using gh CLI.`,
    parameters: SearchParamsSchema,

    async execute(_toolCallId, params) {
      return executeSearch(searchPRs, formatPRSearchResult, params);
    },
  });
}
