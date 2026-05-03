import { ghCmdJson } from "./utils";
import { pushArrayFlag, TypeBoxFields, formatSearchResults } from "./shared";
import type { GHCodeSearchResult } from "./types";
import { Type } from "@sinclair/typebox";
import { countLabel } from "../../shared/rendering/header";
import type { Column } from "../../shared/rendering/types";

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
    countLabel(String(total), "result"),
  );
}

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

export function createSearchCodeTool() {
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
