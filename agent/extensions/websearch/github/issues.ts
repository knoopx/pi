import { Type } from "typebox";
import { ghCmdJson } from "../../../shared/process/gh-cmd";
import { TypeBoxFields } from "../../gh/lib/types";
import { buildFilterArgs } from "../../gh/lib/registration";
import type { GHIssueSearchResult } from "./types";
import { createListItemFormatter } from "./formatting";

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
  owner: TypeBoxFields.ownerFilter,
  repo: TypeBoxFields.repoFilter,
  state: TypeBoxFields.stateFilter,
  label: TypeBoxFields.labelFilter,
  author: TypeBoxFields.authorFilter,
  assignee: TypeBoxFields.assigneeFilter,
});

const formatIssueSearchResult = createListItemFormatter<GHIssueSearchResult>({
  countLabel: (total) => `${String(total)} issues`,
});

export { searchIssues, formatIssueSearchResult };
