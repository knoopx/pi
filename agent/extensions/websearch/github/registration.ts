import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
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
    description: `Search for GitHub repositories using gh CLI.

Use this to:
- Find repositories by language, stars, forks
- Search for specific topics or features
- Discover popular or trending projects
- Find repos by owner or organization

Examples:
- gh-search-repos(query='react framework', limit=10)
- gh-search-repos(query='cli shell', owner=['microsoft'])
- gh-search-repos(query='vim plugin', language='go', stars='>1000')`,
    parameters: SearchReposParams,

    async execute(_toolCallId, params) {
      return executeSearch(searchRepos, formatRepoSearchResult, params);
    },
  });

  pi.registerTool({
    name: "gh-search-code",
    label: "Search Code",
    description: `Search for code across GitHub repositories using gh CLI.

Use this to:
- Find code snippets and patterns across all of GitHub
- Search for specific functions, imports, or configuration patterns
- Locate TODOs, FIXMEs, or comments
- Find specific file types (e.g., Nix configs, package.json files)
- Search within specific users' or organizations' repositories

Examples:
- gh-search-code(query='programs.vim', extension='nix')
- gh-search-code(query='inputs.nixpkgs', filename='flake.nix')
- gh-search-code(query='import React', language='typescript', owner=['microsoft'])`,
    parameters: SearchCodeParams,

    async execute(_toolCallId, params) {
      return executeSearch(searchCode, formatCodeSearchResult, params);
    },
  });

  pi.registerTool({
    name: "gh-search-issues",
    label: "Search Issues",
    description: `Search for issues across GitHub repositories using gh CLI.

Use this to:
- Find open/closed issues
- Search by labels, assignees, authors
- Track bugs and feature requests
- Find issues by state

Examples:
- gh-search-issues(query='bug', state='open', label=['bug'])
- gh-search-issues(query='crash', author='@me')
- gh-search-issues(query='feature request', repo=['facebook/react'], limit=50)`,
    parameters: SearchParamsSchema,

    async execute(_toolCallId, params) {
      return executeSearch(searchIssues, formatIssueSearchResult, params);
    },
  });

  pi.registerTool({
    name: "gh-search-prs",
    label: "Search PRs",
    description: `Search for pull requests across GitHub repositories using gh CLI.

Use this to:
- Find open/merged/closed PRs
- Search by review status, mergeability
- Track PRs by author or status
- Find PRs with specific labels

Examples:
- gh-search-prs(query='fix', state='open')
- gh-search-prs(query='refactor', author='@me')
- gh-search-prs(query='test', repo=['facebook/react'], limit=30)`,
    parameters: SearchParamsSchema,

    async execute(_toolCallId, params) {
      return executeSearch(searchPRs, formatPRSearchResult, params);
    },
  });
}
