import { ghCmd, ghCmdJson } from "./utils";
import type { Column } from "../../shared/rendering/types";
import { createBasicColumns } from "./schema";

interface GHPR {
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
}

export function listPRs(
  owner: string,
  repo: string,
  state?: "open" | "closed" | "merged" | "all",
  limit = 30,
): Promise<GHPR[]> {
  const args: string[] = [
    "pr",
    "list",
    "-R",
    `${owner}/${repo}`,
    `--limit=${limit}`,
  ];
  if (state && state !== "all") args.push(`--state=${state}`);
  args.push(
    "--json=number,title,state,createdAt,updatedAt,baseRefName,headRefName,author,url,mergeable,reviewDecision",
    "--jq",
    "[.[] | . + {html_url: .url}]",
  );

  return ghCmdJson<GHPR[]>(args, "pr list");
}

export function viewPR(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GHPR> {
  return ghCmdJson<GHPR>(
    [
      "pr",
      "view",
      `${prNumber}`,
      "-R",
      `${owner}/${repo}`,
      "--json=number,title,state,createdAt,updatedAt,baseRefName,headRefName,author,body,url,mergeable,reviewDecision,mergeCommit,isCrossRepository",
      "--jq",
      ". + {html_url: .url}",
    ],
    "pr view",
  );
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

export function createPR({
  owner,
  repo,
  title,
  body,
  head,
  base,
  draft,
}: CreatePROpts): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const args = ["pr", "create", "-R", `${owner}/${repo}`, "--title", title];

  if (body) args.push("--body", body);
  if (head) args.push("--head", head);
  if (base) args.push("--base", base);
  if (draft) args.push("--draft");

  return ghCmd(args);
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
  ];
}
