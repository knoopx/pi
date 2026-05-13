import { Type } from "typebox";
import type { Column } from "../../../shared/rendering/types";
import { countLabel } from "../../../shared/rendering/labels";
import { ghCmdJson } from "../../../shared/process/gh-cmd";
import { TypeBoxFields } from "../../gh/lib/types";
import { pushArrayFlag } from "../../gh/lib/registration";
import { formatSearchResults } from "./formatting";
import type { GHRepoSearchResult } from "./types";

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

  return { query, results, total: results.length };
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
        const lines = [`${r.repo}`];
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

export { searchRepos, formatRepoSearchResult, SearchReposParams };
