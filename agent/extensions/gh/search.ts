import { ghCmdJson } from "./utils";
import type {
  GHCodeSearchResult,
  GHIssueSearchResult,
  GHPRSearchResult,
  GHRepoSearchResult,
} from "./types";
import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import type { ToolRenderContext } from "./shared";
import type { Static, TSchema } from "@sinclair/typebox";
import { renderTextToolResult } from "../../shared/render-utils";

/**
 * Search code using gh CLI
 */
export async function searchCode(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHCodeSearchResult[]; total: number }> {
  const results = await ghCmdJson<GHCodeSearchResult[]>(
    [
      "search",
      "code",
      query,
      `--limit=${limit}`,
      "--json=repository,path,sha,textMatches,url",
      "--jq",
      '[.[] | {repo: ((.repository.nameWithOwner // "") | split("/") | .[1] // ""), owner: ((.repository.nameWithOwner // "") | split("/") | .[0] // ""), name: (.path | split("/") | .[-1]), path, html_url: .url, text_matches: [.textMatches[]? | {snippet: .fragment, matches: [.matches[]? | .text]}]}]',
    ],
    "search code",
  );

  return {
    query,
    results,
    total: results.length,
  };
}

/**
 * Search issues using gh CLI
 */
export async function searchIssues(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHIssueSearchResult[]; total: number }> {
  const results = await ghCmdJson<GHIssueSearchResult[]>(
    [
      "search",
      "issues",
      query,
      `--limit=${limit}`,
      "--json=number,title,state,repository,createdAt,labels,url",
      "--jq",
      '[.[] | {number, title, state, repo: (.repository.name // ""), owner: (.repository.owner // ""), createdAt, labels: [.labels[:5][]? | {name}], url}]',
    ],
    "search issues",
  );

  return {
    query,
    results,
    total: results.length,
  };
}

/**
 * Search PRs using gh CLI
 */
export async function searchPRs(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHPRSearchResult[]; total: number }> {
  const results = await ghCmdJson<GHPRSearchResult[]>(
    [
      "search",
      "prs",
      query,
      `--limit=${limit}`,
      "--json=number,title,state,repository,createdAt,updatedAt,labels,url",
      "--jq",
      '[.[] | {number, title, state, repo: (.repository.name // ""), owner: (.repository.owner // ""), createdAt, updatedAt, labels: [.labels[:5][]? | {name}], url, mergeable: ""}]',
    ],
    "search prs",
  );

  return {
    query,
    results,
    total: results.length,
  };
}

/**
 * Search repositories using gh CLI
 */
export async function searchRepos(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHRepoSearchResult[]; total: number }> {
  const results = await ghCmdJson<GHRepoSearchResult[]>(
    [
      "search",
      "repos",
      query,
      `--limit=${limit}`,
      "--json=name,fullName,description,url,language,stargazersCount,forksCount",
      "--jq",
      "[.[] | {name, full_name: .fullName, description, html_url: .url, language, stargazers_count: .stargazersCount, forks_count: .forksCount}]",
    ],
    "search repos",
  );

  return {
    query,
    results,
    total: results.length,
  };
}

import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import {
  dotJoin,
  countLabel,
  table,
  stateDot,
  type Column,
} from "../../shared/renderers";
import { createErrorResult } from "./shared";

/**
 * Format search results into a table
 */
function formatSearchResults<T>(
  result: { query: string; results: T[]; total: number },
  columns: Column[],
  rowMapper: (item: T, index: number) => Record<string, unknown>,
  countLabelFn: (total: number) => string,
): string {
  const rows = result.results.map(rowMapper);
  return [dotJoin(countLabelFn(result.total)), "", table(columns, rows)].join(
    "\n",
  );
}

function formatRepoSearchResult(result: {
  query: string;
  results: GHRepoSearchResult[];
  total: number;
}): string {
  const cols: Column[] = [
    { key: "󰓎", align: "right", minWidth: 6 },
    { key: "󰘬", align: "right", minWidth: 5 },
    {
      key: "repo",
      format(_v, row) {
        const r = row as Record<string, string>;
        const lines = [`${r.repo}${r.private === "true" ? "" : ""}`];
        if (r.description) lines.push(r.description);
        const meta: string[] = [];
        if (r.lang) meta.push(r.lang);
        if (meta.length) lines.push(meta.join(" · "));
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rowMapper = (repo: GHRepoSearchResult) => ({
    "󰓎": repo.stargazers_count.toLocaleString(),
    "󰘬": repo.forks_count.toLocaleString(),
    repo: repo.full_name,
    description: repo.description || "",
    lang: repo.language || "",
    url: repo.html_url,
    private: String(repo.private),
  });

  return formatSearchResults(result, cols, rowMapper, (total) =>
    countLabel(total.toLocaleString(), "repo"),
  );
}

function formatCodeSearchResult(result: {
  query: string;
  results: GHCodeSearchResult[];
  total: number;
}): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 3 },
    {
      key: "path",
      format(_v, row) {
        const r = row as Record<string, string>;
        const lines = [r.path];
        if (r.snippet) lines.push(r.snippet);
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rowMapper = (item: GHCodeSearchResult, i: number) => {
    const snippet = item.text_matches?.[0]?.snippet?.substring(0, 100) ?? "";
    return {
      "#": String(i + 1),
      path: `${item.owner}/${item.repo}/${item.path}`,
      snippet: snippet + (snippet.length >= 100 ? "..." : ""),
      url: item.html_url,
    };
  };

  return formatSearchResults(result, cols, rowMapper, (total) =>
    countLabel(total.toLocaleString(), "result"),
  );
}

interface IssueLikeRow extends Record<string, unknown> {
  "#": string;
  title: string;
  state: string;
  repo: string;
  labels: string;
  url: string;
  date?: string;
  created?: string;
  updated?: string;
  mergeable?: string;
}

function formatIssueLikeSearchResult<TItem, TRow extends IssueLikeRow>(
  result: { query: string; results: TItem[]; total: number },
  rowMapper: (item: TItem, index: number) => TRow,
  titleFormatter: (row: TRow) => string,
  countLabelFn: (total: number) => string,
): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format: (_v, row) => titleFormatter(row as TRow),
    },
  ];

  return formatSearchResults(result, cols, rowMapper, countLabelFn);
}

function formatIssueSearchResult(result: {
  query: string;
  results: GHIssueSearchResult[];
  total: number;
}): string {
  const rowMapper = (issue: GHIssueSearchResult) => ({
    "#": `#${issue.number}`,
    title: issue.title,
    state: issue.state,
    repo: `${issue.owner}/${issue.repo}`,
    date: new Date(issue.createdAt).toLocaleDateString(),
    labels: issue.labels.map((l: { name: string }) => l.name).join(", "),
    url: issue.url,
  });

  const titleFormatter = (row: IssueLikeRow) => {
    const dot = row.state === "open" ? stateDot("on") : stateDot("off");
    const lines = [`${dot} ${row.title}`];
    lines.push(`${row.repo} · ${row.date}`);
    if (row.labels) lines.push(row.labels);
    lines.push(row.url);
    return lines.join("\n");
  };

  return formatIssueLikeSearchResult(
    result,
    rowMapper,
    titleFormatter,
    (total) => `${total.toLocaleString()} issues`,
  );
}

function formatPRSearchResult(result: {
  query: string;
  results: GHPRSearchResult[];
  total: number;
}): string {
  const rowMapper = (pr: GHPRSearchResult) => ({
    "#": `#${pr.number}`,
    title: pr.title,
    state: pr.state,
    mergeable: pr.mergeable,
    repo: `${pr.owner}/${pr.repo}`,
    created: new Date(pr.createdAt).toLocaleDateString(),
    updated: new Date(pr.updatedAt).toLocaleDateString(),
    labels: pr.labels.map((l: { name: string }) => l.name).join(", "),
    url: pr.url,
  });

  const titleFormatter = (row: IssueLikeRow) => {
    const dot = row.state === "open" ? stateDot("on") : stateDot("off");
    const merge =
      row.mergeable === "MERGEABLE"
        ? "✓"
        : row.mergeable === "CONFLICTING"
          ? "✗"
          : "?";
    const lines = [`${dot} ${row.title} ${merge}`];
    lines.push(`${row.repo} · ${row.created} – ${row.updated}`);
    if (row.labels) lines.push(row.labels);
    lines.push(row.url);
    return lines.join("\n");
  };

  return formatIssueLikeSearchResult(
    result,
    rowMapper,
    titleFormatter,
    (total) => `${total.toLocaleString()} PRs`,
  );
}

/**
 * Create a search tool renderer with common patterns
 */
function createSearchToolRenderer(toolName: string) {
  return {
    renderCall(
      args: unknown,
      theme: Theme,
      _context: ToolRenderContext<unknown, unknown>,
    ) {
      const typedArgs = args as { query?: string; limit?: number };
      let text = theme.fg("toolTitle", theme.bold(toolName));
      if (typedArgs.query) text += theme.fg("muted", ` "${typedArgs.query}"`);
      if (typedArgs.limit)
        text += theme.fg("dim", ` (limit=${typedArgs.limit})`);
      return new Text(text, 0, 0);
    },
    renderResult(
      result: unknown,
      _options: ToolRenderResultOptions,
      theme: Theme,
      _context: ToolRenderContext<unknown, unknown>,
    ) {
      return renderTextToolResult(result as AgentToolResult<unknown>, theme);
    },
  };
}

/**
 * Options for registering a search tool
 */
interface RegisterSearchToolOptions<TParams extends TSchema, TResult> {
  toolName: string;
  toolLabel: string;
  toolDescription: string;
  paramsSchema: TParams;
  searchFn: (query: string, limit?: number) => Promise<TResult>;
  formatFn: (result: TResult) => string;
}

/**
 * Register a search tool with common pattern
 */
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
      _toolCallId: string,
      params: Static<TParams> & { query: string; limit?: number },
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await searchFn(params.query, params.limit);
        const output = formatFn(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },
    ...createSearchToolRenderer(toolName),
  });
}

const SearchReposParams = Type.Object({
  query: Type.String({
    description: "Search query (e.g., 'language:typescript stars:>1000')",
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
});

const SearchCodeParams = Type.Object({
  query: Type.String({
    description: `GitHub code search query. Use qualifiers to filter results:
    - extension:ext - Filter by file extension (e.g., extension:nix, extension:ts)
    - filename:pattern - Search specific filenames (e.g., filename:flake.nix)
    - user:username or owner:username - Limit to a specific user
    - repo:owner/name - Limit to a specific repository
    - language:Lang - Filter by programming language
    
    Examples:
    - 'extension:nix programs.vim' - Find .nix files mentioning vim
    - 'flake.nix user:nixos' - Find flake.nix in nixos user's repos
    - 'filename:configuration.nix extension:nix' - Find NixOS configs`,
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
});

const SearchIssuesParams = Type.Object({
  query: Type.String({
    description: "Issues search query (e.g., 'is:open label:bug')",
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
});

const SearchPRsParams = Type.Object({
  query: Type.String({
    description: "PRs search query (e.g., 'is:open review:required')",
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
});

export function registerSearchTools(pi: ExtensionAPI) {
  registerSearchTool(pi, {
    toolName: "gh-search-repos",
    toolLabel: "Search Repositories",
    toolDescription: `Search for GitHub repositories using gh CLI.

Use this to:
- Find repositories by language, stars, forks
- Search for specific topics or features
- Discover popular or trending projects
- Find repos by owner or organization

Examples:
- gh-search-repos(query='language:typescript stars:>1000')
- gh-search-repos(query='react framework', limit=10)
- gh-search-repos(query='owner:microsoft')`,
    paramsSchema: SearchReposParams,
    searchFn: searchRepos,
    formatFn: formatRepoSearchResult,
  });

  registerSearchTool(pi, {
    toolName: "gh-search-code",
    toolLabel: "Search Code",
    toolDescription: `Search for code across GitHub repositories using gh CLI and GitHub's code search syntax.

Use this to:
- Find code snippets and patterns across all of GitHub
- Search for specific functions, imports, or configuration patterns
- Locate TODOs, FIXMEs, or comments
- Find specific file types (e.g., Nix configs, package.json files)
- Search within specific users' or organizations' repositories

Query syntax:
- extension:ext — Filter by file extension (e.g., extension:nix, extension:ts, extension:json)
- filename:pattern — Match specific filenames (e.g., filename:flake.nix, filename:package.json)
- user:username or owner:username — Limit search to a specific user's repositories
- repo:owner/name — Limit search to a specific repository
- language:Lang — Filter by programming language

Examples:
- Search Nix configurations:
  gh-search-code(query='extension:nix programs.vim.enable')
  gh-search-code(query='filename:flake.nix inputs.nixpkgs')
  gh-search-code(query='user:nixos filename:configuration.nix')

- Search by file type:
  gh-search-code(query='extension:ts import React')
  gh-search-code(query='filename:package.json dependencies')

- Search within specific repos/users:
  gh-search-code(query='owner:microsoft extension:ts')
  gh-search-code(query='repo:facebook/react extension:tsx')`,
    paramsSchema: SearchCodeParams,
    searchFn: searchCode,
    formatFn: formatCodeSearchResult,
  });

  registerSearchTool(pi, {
    toolName: "gh-search-issues",
    toolLabel: "Search Issues",
    toolDescription: `Search for issues across GitHub repositories using gh CLI.

Use this to:
- Find open/closed issues
- Search by labels, assignees, authors
- Track bugs and feature requests
- Find issues by state

Examples:
- gh-search-issues(query='is:open label:bug')
- gh-search-issues(query='author:@me is:closed')
- gh-search-issues(query='state:open assigned:@me', limit=50)`,
    paramsSchema: SearchIssuesParams,
    searchFn: searchIssues,
    formatFn: formatIssueSearchResult,
  });

  registerSearchTool(pi, {
    toolName: "gh-search-prs",
    toolLabel: "Search PRs",
    toolDescription: `Search for pull requests across GitHub repositories using gh CLI.

Use this to:
- Find open/merged/closed PRs
- Search by review status, mergeability
- Track PRs by author or status
- Find PRs with specific labels

Examples:
- gh-search-prs(query='is:open review:required')
- gh-search-prs(query='author:@me is:merged')
- gh-search-prs(query='status:success', limit=30)`,
    paramsSchema: SearchPRsParams,
    searchFn: searchPRs,
    formatFn: formatPRSearchResult,
  });
}
