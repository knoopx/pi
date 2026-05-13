import type { GHPRSearchResult } from "./types";
import { searchWithFilters, SearchParams } from "./issues";
import { createListItemFormatter } from "./formatting";

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

export { searchPRs, formatPRSearchResult };
