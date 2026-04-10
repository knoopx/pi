import { ghCmd } from "./utils";
import type {
  GHCodeSearchResult,
  GHIssueSearchResult,
  GHPRSearchResult,
  GHRepoSearchResult,
} from "./types";

/**
 * Search code using gh CLI
 */
export async function searchCode(
  query: string,
  limit = 20,
): Promise<{ query: string; results: GHCodeSearchResult[]; total: number }> {
  const result = await ghCmd([
    "search",
    "code",
    query,
    `--limit=${limit}`,
    "--json=repository,path,sha,textMatches,url",
    "--jq",
    '[.[] | {repo: ((.repository.nameWithOwner // "") | split("/") | .[1] // ""), owner: ((.repository.nameWithOwner // "") | split("/") | .[0] // ""), name: (.path | split("/") | .[-1]), path, html_url: .url, text_matches: [.textMatches[]? | {snippet: .fragment, matches: [.matches[]? | .text]}]}]',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh search code failed: ${result.stderr || result.stdout}`);
  }

  let results: GHCodeSearchResult[];
  try {
    results = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh search code output: ${result.stdout}`);
  }

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
  const result = await ghCmd([
    "search",
    "issues",
    query,
    `--limit=${limit}`,
    "--json=number,title,state,repository,createdAt,labels,url",
    "--jq",
    '[.[] | {number, title, state, repo: (.repository.name // ""), owner: (.repository.owner // ""), createdAt, labels: [.labels[:5][]? | {name}], url}]',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh search issues failed: ${result.stderr || result.stdout}`,
    );
  }

  let results: GHIssueSearchResult[];
  try {
    results = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Failed to parse gh search issues output: ${result.stdout}`,
    );
  }

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
  const result = await ghCmd([
    "search",
    "prs",
    query,
    `--limit=${limit}`,
    "--json=number,title,state,repository,createdAt,updatedAt,labels,url",
    "--jq",
    '[.[] | {number, title, state, repo: (.repository.name // ""), owner: (.repository.owner // ""), createdAt, updatedAt, labels: [.labels[:5][]? | {name}], url, mergeable: ""}]',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh search prs failed: ${result.stderr || result.stdout}`);
  }

  let results: GHPRSearchResult[];
  try {
    results = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh search prs output: ${result.stdout}`);
  }

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
  const result = await ghCmd([
    "search",
    "repos",
    query,
    `--limit=${limit}`,
    "--json=name,fullName,description,url,language,stargazersCount,forksCount",
    "--jq",
    "[.[] | {name, full_name: .fullName, description, html_url: .url, language, stargazers_count: .stargazersCount, forks_count: .forksCount}]",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `gh search repos failed: ${result.stderr || result.stdout}`,
    );
  }

  let results: GHRepoSearchResult[];
  try {
    results = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh search repos output: ${result.stdout}`);
  }

  return {
    query,
    results,
    total: results.length,
  };
}

import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { renderTextToolResult } from "../../shared/render-utils";
import {
  dotJoin,
  countLabel,
  table,
  stateDot,
  type Column,
} from "../../shared/renderers";

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
      format: (_v, row) => {
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

  const rows = result.results.map((repo) => ({
    "󰓎": repo.stargazers_count.toLocaleString(),
    "󰘬": repo.forks_count.toLocaleString(),
    repo: repo.full_name,
    description: repo.description || "",
    lang: repo.language || "",
    url: repo.html_url,
    private: String(repo.private),
  }));

  return [
    dotJoin(countLabel(result.total.toLocaleString(), "repo")),
    "",
    table(cols, rows),
  ].join("\n");
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
      format: (_v, row) => {
        const r = row as Record<string, string>;
        const lines = [r.path];
        if (r.snippet) lines.push(r.snippet);
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rows = result.results.map((item, i) => {
    const snippet = item.text_matches?.[0]?.snippet?.substring(0, 100) ?? "";
    return {
      "#": String(i + 1),
      path: `${item.owner}/${item.repo}/${item.path}`,
      snippet: snippet + (snippet.length >= 100 ? "..." : ""),
      url: item.html_url,
    };
  });

  return [
    dotJoin(countLabel(result.total.toLocaleString(), "result")),
    "",
    table(cols, rows),
  ].join("\n");
}

function formatIssueSearchResult(result: {
  query: string;
  results: GHIssueSearchResult[];
  total: number;
}): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format: (_v, row) => {
        const r = row as Record<string, string>;
        const dot = r.state === "open" ? stateDot("on") : stateDot("off");
        const lines = [`${dot} ${r.title}`];
        lines.push(`${r.repo} · ${r.date}`);
        if (r.labels) lines.push(r.labels);
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rows = result.results.map((issue) => ({
    "#": `#${issue.number}`,
    title: issue.title,
    state: issue.state,
    repo: `${issue.owner}/${issue.repo}`,
    date: new Date(issue.createdAt).toLocaleDateString(),
    labels: issue.labels.map((l: { name: string }) => l.name).join(", "),
    url: issue.url,
  }));

  return [
    dotJoin(`${result.total.toLocaleString()} issues`),
    "",
    table(cols, rows),
  ].join("\n");
}

function formatPRSearchResult(result: {
  query: string;
  results: GHPRSearchResult[];
  total: number;
}): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format: (_v, row) => {
        const r = row as Record<string, string>;
        const dot = r.state === "open" ? stateDot("on") : stateDot("off");
        const merge =
          r.mergeable === "MERGEABLE"
            ? "✓"
            : r.mergeable === "CONFLICTING"
              ? "✗"
              : "?";
        const lines = [`${dot} ${r.title} ${merge}`];
        lines.push(`${r.repo} · ${r.created} – ${r.updated}`);
        if (r.labels) lines.push(r.labels);
        lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];

  const rows = result.results.map((pr) => ({
    "#": `#${pr.number}`,
    title: pr.title,
    state: pr.state,
    mergeable: pr.mergeable,
    repo: `${pr.owner}/${pr.repo}`,
    created: new Date(pr.createdAt).toLocaleDateString(),
    updated: new Date(pr.updatedAt).toLocaleDateString(),
    labels: pr.labels.map((l: { name: string }) => l.name).join(", "),
    url: pr.url,
  }));

  return [
    dotJoin(`${result.total.toLocaleString()} PRs`),
    "",
    table(cols, rows),
  ].join("\n");
}

function createErrorResult(
  message: string,
): AgentToolResult<{ error?: string }> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
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

type SearchReposParamsType = Static<typeof SearchReposParams>;
type SearchCodeParamsType = Static<typeof SearchCodeParams>;
type SearchIssuesParamsType = Static<typeof SearchIssuesParams>;
type SearchPRsParamsType = Static<typeof SearchPRsParams>;

export function registerSearchTools(pi: ExtensionAPI) {
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
- gh-search-repos(query='language:typescript stars:>1000')
- gh-search-repos(query='react framework', limit=10)
- gh-search-repos(query='owner:microsoft')`,
    parameters: SearchReposParams as any,

    async execute(
      _toolCallId: string,
      params: SearchReposParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate:
        | AgentToolUpdateCallback<
            | { query: string; results: GHRepoSearchResult[]; total: number }
            | { error?: string }
          >
        | undefined,
      _ctx: ExtensionContext,
    ): Promise<
      AgentToolResult<
        | { query: string; results: GHRepoSearchResult[]; total: number }
        | { error?: string }
      >
    > {
      try {
        const result = await searchRepos(params.query, params.limit);
        const output = formatRepoSearchResult(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-search-repos"));
      if (args.query) {
        text += theme.fg("muted", ` "${args.query}"`);
      }
      if (args.limit) {
        text += theme.fg("dim", ` (limit=${args.limit})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-search-code",
    label: "Search Code",
    description: `Search for code across GitHub repositories using gh CLI and GitHub's code search syntax.

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
    parameters: SearchCodeParams as any,

    async execute(
      _toolCallId: string,
      params: SearchCodeParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await searchCode(params.query, params.limit || 20);
        const output = formatCodeSearchResult(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-search-code"));
      if (args.query) {
        text += theme.fg("muted", ` "${args.query}"`);
      }
      if (args.limit) {
        text += theme.fg("dim", ` (limit=${args.limit})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
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
- gh-search-issues(query='is:open label:bug')
- gh-search-issues(query='author:@me is:closed')
- gh-search-issues(query='state:open assigned:@me', limit=50)`,
    parameters: SearchIssuesParams as any,

    async execute(
      _toolCallId: string,
      params: SearchIssuesParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await searchIssues(params.query, params.limit || 20);
        const output = formatIssueSearchResult(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-search-issues"));
      if (args.query) {
        text += theme.fg("muted", ` "${args.query}"`);
      }
      if (args.limit) {
        text += theme.fg("dim", ` (limit=${args.limit})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
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
- gh-search-prs(query='is:open review:required')
- gh-search-prs(query='author:@me is:merged')
- gh-search-prs(query='status:success', limit=30)`,
    parameters: SearchPRsParams as any,

    async execute(
      _toolCallId: string,
      params: SearchPRsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const result = await searchPRs(params.query, params.limit || 20);
        const output = formatPRSearchResult(result);
        return {
          content: [{ type: "text", text: output }],
          details: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-search-prs"));
      if (args.query) {
        text += theme.fg("muted", ` "${args.query}"`);
      }
      if (args.limit) {
        text += theme.fg("dim", ` (limit=${args.limit})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });
}
