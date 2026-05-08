import { ghCmdJson } from "./utils";
import { pushArrayFlag, TypeBoxFields, formatSearchResults } from "./shared";
import type { GHRepoSearchResult } from "./types";
import { Type } from "typebox";
import { countLabel } from "../../shared/rendering/header";
import type { Column } from "../../shared/rendering/types";

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

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
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

export function createSearchReposTool() {
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
