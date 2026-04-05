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

  let results: GHCodeSearchResult[] = [];
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

  let results: GHIssueSearchResult[] = [];
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

  let results: GHPRSearchResult[] = [];
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

  let results: GHRepoSearchResult[] = [];
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
