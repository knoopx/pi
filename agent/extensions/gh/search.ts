import { ghCmdJson } from "./utils";
import {
  createErrorResult,
  buildFilterArgs,
  pushArrayFlag,
  TypeBoxFields,
} from "./shared";
import type {
  GHCodeSearchResult,
  GHIssueSearchResult,
  GHPRSearchResult,
  GHRepoSearchResult,
} from "./types";
import type {
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";

import type { Static, TSchema } from "@sinclair/typebox";
import { renderTextToolResult } from "../../shared/render-utils";
interface CodeSearchParams {
  query: string;
  limit?: number;
  extension?: string;
  filename?: string;
  language?: string;
  owner?: string[];
  repo?: string[];
}

async function searchCode(
  params: CodeSearchParams,
): Promise<{ query: string; results: GHCodeSearchResult[]; total: number }> {
  const {
    query,
    limit = 20,
    extension,
    filename,
    language,
    owner,
    repo,
  } = params;
  const args: string[] = ["search", "code", query, `--limit=${limit}`];

  if (extension) args.push(`--extension=${extension}`);
  if (filename) args.push(`--filename=${filename}`);
  if (language) args.push(`--language=${language}`);
  pushArrayFlag(args, owner, "owner");
  pushArrayFlag(args, repo, "repo");

  args.push(
    "--json=repository,path,sha,textMatches,url",
    "--jq",
    '[.[] | {repo: ((.repository.nameWithOwner // "") | split("/") | .[1] // ""), owner: ((.repository.nameWithOwner // "") | split("/") | .[0] // ""), name: (.path | split("/") | .[-1]), path, html_url: .url, text_matches: [.textMatches[]? | {snippet: .fragment, matches: [.matches[]? | .text]}]}]',
  );
  const results = await ghCmdJson<GHCodeSearchResult[]>(args, "search code");

  return {
    query,
    results,
    total: results.length,
  };
}
interface SearchParams {
  query?: string;
  limit?: number;
  owner?: string[];
  repo?: string[];
  state?: "open" | "closed";
  label?: string[];
  author?: string;
  assignee?: string;
}

async function searchWithFilters<T>(
  command: "issues" | "prs",
  params: SearchParams,
  jsonFields: string,
  jqFilter: string,
): Promise<{ query: string; results: T[]; total: number }> {
  const {
    query = "",
    limit = 20,
    owner,
    repo,
    state,
    label,
    author,
    assignee,
  } = params;
  const args = buildFilterArgs(
    command,
    limit,
    query,
    owner,
    repo,
    state,
    label,
    author,
    assignee,
  );

  args.push(`--json=${jsonFields}`, "--jq", jqFilter);
  const results = await ghCmdJson<T[]>(args, `search ${command}`);

  return { query: query || "", results, total: results.length };
}

async function searchIssues(
  params: SearchParams,
): Promise<{ query: string; results: GHIssueSearchResult[]; total: number }> {
  return searchWithFilters<GHIssueSearchResult>(
    "issues",
    params,
    "number,title,state,repository,createdAt,labels,url",
    '[.[] | {number, title, state, repo: (.repository.name // ""), owner: (.repository.owner // ""), createdAt, labels: [.labels[:5][]? | {name}], url}]',
  );
}

async function searchPRs(
  params: SearchParams,
): Promise<{ query: string; results: GHPRSearchResult[]; total: number }> {
  return searchWithFilters<GHPRSearchResult>(
    "prs",
    params,
    "number,title,state,repository,createdAt,updatedAt,labels,url",
    '[.[] | {number, title, state, repo: (.repository.name // ""), owner: (.repository.owner // ""), createdAt, updatedAt, labels: [.labels[:5][]? | {name}], url, mergeable: ""}]',
  );
}
interface RepoSearchParams {
  query: string;
  limit?: number;
  owner?: string[];
  language?: string;
  topic?: string[];
  stars?: string;
  forks?: string;
}

async function searchRepos(
  params: RepoSearchParams,
): Promise<{ query: string; results: GHRepoSearchResult[]; total: number }> {
  const { query, limit = 20, owner, language, topic, stars, forks } = params;
  const args: string[] = ["search", "repos", `--limit=${limit}`];

  if (query) args.push(query);
  pushArrayFlag(args, owner, "owner");
  if (language) args.push(`--language=${language}`);
  pushArrayFlag(args, topic, "topic");
  if (stars) args.push(`--stars=${stars}`);
  if (forks) args.push(`--forks=${forks}`);

  args.push(
    "--json=name,fullName,description,url,language,stargazersCount,forksCount",
    "--jq",
    "[.[] | {name, full_name: .fullName, description, html_url: .url, language, stargazers_count: .stargazersCount, forks_count: .forksCount}]",
  );
  const results = await ghCmdJson<GHRepoSearchResult[]>(args, "search repos");

  return {
    query,
    results,
    total: results.length,
  };
}

import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { dotJoin, countLabel } from "../../shared/renderers/header";
import { table } from "../../shared/renderers/table/renderer";
import { stateDot } from "../../shared/renderers/header";
import type { Column } from "../../shared/renderers/types";
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
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
    "󰓎": formatNumber(repo.stargazers_count),
    "󰘬": formatNumber(repo.forks_count),
    repo: repo.full_name,
    description: repo.description || "",
    lang: repo.language || "",
    url: repo.html_url,
    private: String(repo.private),
  });

  return formatSearchResults(result, cols, rowMapper, (total) =>
    countLabel(formatNumber(total), "repo"),
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
    countLabel(formatNumber(total), "result"),
  );
}
interface SearchResultRow extends Record<string, unknown> {
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
function formatSearchResult<TItem, TRow extends SearchResultRow>(
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
interface GHListItemResult {
  number: number;
  title: string;
  state: string;
  owner: string;
  repo: string;
  createdAt: string;
  labels: Array<{ name: string }>;
  url: string;
}
interface ListItemFormatOptions<Item extends GHListItemResult> {
  countLabel: (total: number) => string;
  titleBadge?: (row: SearchResultRow) => string;
  subtitleLine?: (row: SearchResultRow) => string;
  additionalFields?: (item: Item) => Record<string, string>;
}
function createListItemFormatter<Item extends GHListItemResult>(
  options: ListItemFormatOptions<Item>,
): (result: { query: string; results: Item[]; total: number }) => string {
  return (result) => {
    const rowMapper = (item: Item) => ({
      "#": `#${item.number}`,
      title: item.title,
      state: item.state,
      repo: `${item.owner}/${item.repo}`,
      labels: item.labels.map((l) => l.name).join(", "),
      url: item.url,
      ...(options.additionalFields?.(item) ?? {}),
    });
    const titleFormatter = (row: SearchResultRow) => {
      const dot = row.state === "open" ? stateDot("on") : stateDot("off");
      const badge = options.titleBadge?.(row) ?? "";
      const subtitle =
        options.subtitleLine?.(row) ?? `${row.repo} · ${row.date}`;
      const lines = [`${dot} ${row.title}${badge ? ` ${badge}` : ""}`];
      lines.push(subtitle);
      if (row.labels) lines.push(row.labels);
      lines.push(row.url);
      return lines.join("\n");
    };

    return formatSearchResult(
      result,
      rowMapper,
      titleFormatter,
      options.countLabel,
    );
  };
}
const formatIssueSearchResult = createListItemFormatter<GHIssueSearchResult>({
  countLabel: (total) => `${formatNumber(total)} issues`,
});
const formatPRSearchResult = createListItemFormatter<GHPRSearchResult>({
  countLabel: (total) => `${formatNumber(total)} PRs`,
  additionalFields: (pr) => ({
    mergeable: pr.mergeable,
    created: new Date(pr.createdAt).toLocaleDateString(),
    updated: new Date(pr.updatedAt).toLocaleDateString(),
  }),
  titleBadge: (row) => {
    const merge =
      row.mergeable === "MERGEABLE"
        ? "✓"
        : row.mergeable === "CONFLICTING"
          ? "✗"
          : "?";
    return merge;
  },
  subtitleLine: (row) => `${row.repo} · ${row.created} - ${row.updated}`,
});
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
const SearchReposParams = Type.Object({
  query: TypeBoxFields.searchQuery,
  limit: TypeBoxFields.searchLimit,
  owner: TypeBoxFields.ownerFilter,
  language: Type.Optional(
    Type.String({
      description: "Filter based on the coding language",
    }),
  ),
  topic: Type.Optional(
    Type.Array(Type.String(), {
      description: "Filter on topic",
    }),
  ),
  stars: Type.Optional(
    Type.String({
      description: "Filter on number of stars (e.g., '>1000')",
    }),
  ),
  forks: Type.Optional(
    Type.String({
      description: "Filter on number of forks (e.g., '>100')",
    }),
  ),
});
const SearchCodeParams = Type.Object({
  query: TypeBoxFields.searchQuery,
  limit: TypeBoxFields.searchLimit,
  extension: Type.Optional(
    Type.String({
      description: "Filter on file extension",
    }),
  ),
  filename: Type.Optional(
    Type.String({
      description: "Filter on filename",
    }),
  ),
  language: Type.Optional(
    Type.String({
      description: "Filter results by language",
    }),
  ),
  owner: TypeBoxFields.ownerFilter,
  repo: TypeBoxFields.repoFilter,
});
const SearchParamsSchema = Type.Object({
  query: Type.String({
    description: "Search query keywords (optional, use filters instead)",
  }),
  limit: TypeBoxFields.searchLimit,
  owner: Type.Optional(
    Type.Array(Type.String(), {
      description: "Filter on repository owner",
    }),
  ),
  repo: TypeBoxFields.repoFilter,
  state: TypeBoxFields.stateFilter,
  label: TypeBoxFields.labelFilter,
  author: TypeBoxFields.authorFilter,
  assignee: TypeBoxFields.assigneeFilter,
});
function createSearchReposTool() {
  return {
    toolName: "gh-search-repos",
    toolLabel: "Search Repositories",
    toolDescription: `Search for GitHub repositories using gh CLI.

Use this to:
- Find repositories by language, stars, forks
- Search for specific topics or features
- Discover popular or trending projects
- Find repos by owner or organization

Examples:
- gh-search-repos(query='react framework', limit=10)
- gh-search-repos(query='cli shell', owner=['microsoft'])
- gh-search-repos(query='vim plugin', language='go', stars='>1000')`,
    paramsSchema: SearchReposParams,
    searchFn: searchRepos as (params: unknown) => Promise<unknown>,
    formatFn: formatRepoSearchResult as (result: unknown) => string,
  };
}
function createSearchCodeTool() {
  return {
    toolName: "gh-search-code",
    toolLabel: "Search Code",
    toolDescription: `Search for code across GitHub repositories using gh CLI.

Use this to:
- Find code snippets and patterns across all of GitHub
- Search for specific functions, imports, or configuration patterns
- Locate TODOs, FIXMEs, or comments
- Find specific file types (e.g., Nix configs, package.json files)
- Search within specific users' or organizations' repositories

Examples:
- gh-search-code(query='programs.vim', extension='nix')
- gh-search-code(query='inputs.nixpkgs', filename='flake.nix')
- gh-search-code(query='import React', language='typescript', owner=['microsoft'])
- gh-search-code(query='lint', filename='package.json', repo=['facebook/react'])`,
    paramsSchema: SearchCodeParams,
    searchFn: searchCode as (params: unknown) => Promise<unknown>,
    formatFn: formatCodeSearchResult as (result: unknown) => string,
  };
}
function createSearchIssuesTool() {
  return {
    toolName: "gh-search-issues",
    toolLabel: "Search Issues",
    toolDescription: `Search for issues across GitHub repositories using gh CLI.

Use this to:
- Find open/closed issues
- Search by labels, assignees, authors
- Track bugs and feature requests
- Find issues by state

Examples:
- gh-search-issues(query='bug', state='open', label=['bug'])
- gh-search-issues(query='crash', author='@me')
- gh-search-issues(query='feature request', repo=['facebook/react'], limit=50)`,
    paramsSchema: SearchParamsSchema,
    searchFn: searchIssues as (params: unknown) => Promise<unknown>,
    formatFn: formatIssueSearchResult as (result: unknown) => string,
  };
}
function createSearchPRsTool() {
  return {
    toolName: "gh-search-prs",
    toolLabel: "Search PRs",
    toolDescription: `Search for pull requests across GitHub repositories using gh CLI.

Use this to:
- Find open/merged/closed PRs
- Search by review status, mergeability
- Track PRs by author or status
- Find PRs with specific labels

Examples:
- gh-search-prs(query='fix', state='open')
- gh-search-prs(query='refactor', author='@me')
- gh-search-prs(query='test', repo=['facebook/react'], limit=30)`,
    paramsSchema: SearchParamsSchema,
    searchFn: searchPRs as (params: unknown) => Promise<unknown>,
    formatFn: formatPRSearchResult as (result: unknown) => string,
  };
}
export function registerSearchTools(pi: ExtensionAPI) {
  registerSearchTool(pi, createSearchReposTool());
  registerSearchTool(pi, createSearchCodeTool());
  registerSearchTool(pi, createSearchIssuesTool());
  registerSearchTool(pi, createSearchPRsTool());
}
