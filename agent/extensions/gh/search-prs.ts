import type { GHPRSearchResult } from "./types";
import {
  searchWithFilters,
  SearchParams,
  SearchParamsSchema,
} from "./search-issues";
import { countLabel } from "../../shared/rendering/header";
import { createListItemFormatter } from "./search-list-formatter";

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

const formatPRSearchResult = createListItemFormatter<GHPRSearchResult>({
  countLabel: (total) => `${String(total)} PRs`,
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

export function createSearchPRsTool() {
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
