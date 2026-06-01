import { ghCmd, ghCmdJson } from "../../../shared/process/gh-cmd";
import type { Column } from "../../../shared/rendering/types";
import { createBasicColumns } from "../lib/types";
import {
  buildListArgs,
  buildViewArgs,
  listResource,
  viewResource,
} from "./base";

const PR_JSON_FIELDS =
  "number,title,state,createdAt,updatedAt,baseRefName,headRefName,author,body,url,mergeable,reviewDecision,mergeCommit,isCrossRepository";
const PR_LIST_JSON_FIELDS =
  "number,title,state,createdAt,updatedAt,baseRefName,headRefName,author,url,mergeable,reviewDecision";

export interface GHPRReview {
  id: string;
  body: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  createdAt: string;
  author: { login: string; avatar_url: string; html_url: string } | null;
}

export interface GHPR {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  baseRefName: string;
  headRefName: string;
  author: { login: string; avatar_url: string; html_url: string };
  body: string;
  html_url: string;
  mergeable: string;
  reviewDecision: string;
  reviews: GHPRReview[];
}

export function listPRs(
  owner: string,
  repo: string,
  state?: "open" | "closed" | "merged" | "all",
  limit = 30,
): Promise<GHPR[]> {
  return listResource<GHPR>(
    buildListArgs("pr", owner, repo, state, limit, PR_LIST_JSON_FIELDS),
    "pr list",
  );
}

async function fetchPRReviews(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GHPRReview[]> {
  return ghCmdJson<GHPRReview[]>(
    [
      "api",
      `repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      "--jq", "[.[] | {id: .node_id, body: .body, state: .state, createdAt: .submitted_at, author: (if .user then {login: .user.login, avatar_url: .user.avatar_url, html_url: .user.html_url} else null end)}]",
    ],
    "pr reviews",
  );
}

export async function viewPR(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GHPR> {
  const pr = await viewResource<GHPR>(
    buildViewArgs("pr", owner, repo, prNumber, PR_JSON_FIELDS),
    "pr view",
  );
  const reviews = await fetchPRReviews(owner, repo, prNumber);
  return { ...pr, reviews };
}

interface CreatePROpts {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  head?: string;
  base?: string;
  draft?: boolean;
}

function appendOptionalPrArgs(args: string[], opts: CreatePROpts): void {
  const optional = [
    ["body", opts.body],
    ["head", opts.head],
    ["base", opts.base],
  ] as const;
  for (const [flag, value] of optional) {
    if (value) args.push(`--${flag}`, value);
  }
  if (opts.draft) args.push("--draft");
}

function buildCreatePrArgs(opts: CreatePROpts): string[] {
  const args = [
    "pr",
    "create",
    "-R",
    `${opts.owner}/${opts.repo}`,
    "--title",
    opts.title,
  ];
  appendOptionalPrArgs(args, opts);
  return args;
}

export function createPR(opts: CreatePROpts): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return ghCmd(buildCreatePrArgs(opts));
}

export function createPrColumns(): Column[] {
  return createBasicColumns(
    (r) => `${r.base} ← ${r.head} · ${r.author} · ${r.date}\n${r.url}`,
  );
}

export function createPrRowMapper() {
  return (pr: GHPR) => ({
    "#": `#${pr.number}`,
    title: pr.title,
    state: pr.state,
    base: pr.baseRefName,
    head: pr.headRefName,
    author: pr.author?.login ?? "",
    date: new Date(pr.createdAt).toLocaleDateString(),
    url: pr.html_url,
  });
}

function formatReviews(reviews: GHPRReview[]): string {
  if (!reviews || reviews.length === 0) return "none";
  const lines = reviews.map((r) => {
    const author = r.author?.login ?? "unknown";
    const date = new Date(r.createdAt).toLocaleString();
    return `@${author} (${date}) — ${r.state}\n${r.body}`;
  });
  return lines.join("\n---\n");
}

export function createPrFields() {
  return (pr: GHPR) => [
    { label: "title", value: `#${pr.number} ${pr.title}` },
    { label: "state", value: pr.state },
    { label: "author", value: pr.author?.login ?? "unknown" },
    { label: "branch", value: `${pr.baseRefName} ← ${pr.headRefName}` },
    { label: "mergeable", value: pr.mergeable },
    { label: "review", value: pr.reviewDecision || "none" },
    { label: "created", value: new Date(pr.createdAt).toLocaleString() },
    { label: "url", value: pr.html_url },
    { label: "reviews", value: formatReviews(pr.reviews) },
  ];
}
