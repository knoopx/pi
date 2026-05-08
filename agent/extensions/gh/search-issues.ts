import { ghCmdJson } from "./utils";
import { buildFilterArgs, TypeBoxFields } from "./shared";
import type { GHIssueSearchResult } from "./types";
import { Type } from "typebox";

import { createListItemFormatter } from "./search-list-formatter";

export interface SearchParams {
  query?: string;
  limit?: number;
  owner?: string[];
  repo?: string[];
  state?: "open" | "closed";
  label?: string[];
  author?: string;
  assignee?: string;
}

export async function searchWithFilters<T>(
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

export const SearchParamsSchema = Type.Object({
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

const formatIssueSearchResult = createListItemFormatter<GHIssueSearchResult>({
  countLabel: (total) => `${String(total)} issues`,
});

export function createSearchIssuesTool() {
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
