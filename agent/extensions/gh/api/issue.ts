import { ghCmd } from "../../../shared/process/gh-cmd";
import type { Column } from "../../../shared/rendering/types";
import { createBasicColumns } from "../lib/types";
import {
  buildListArgs,
  buildViewArgs,
  listResource,
  viewResource,
} from "./base";

const ISSUE_JSON_FIELDS =
  "number,title,state,createdAt,updatedAt,author,body,url,labels,milestone";

interface GHIssue {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatar_url: string; html_url: string };
  body: string;
  html_url: string;
  labels: { name: string; description: string; color: string }[];
  milestone: { title: string; description: string; dueOn: string } | null;
}

export function listIssues(
  owner: string,
  repo: string,
  state?: "open" | "closed" | "merged" | "all",
  limit = 30,
): Promise<GHIssue[]> {
  return listResource<GHIssue>(
    buildListArgs("issue", owner, repo, state, limit, ISSUE_JSON_FIELDS),
    "issue list",
  );
}

export function viewIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GHIssue> {
  return viewResource<GHIssue>(
    buildViewArgs("issue", owner, repo, issueNumber, ISSUE_JSON_FIELDS),
    "issue view",
  );
}

interface CreateIssueOpts {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}

export function createIssue({
  owner,
  repo,
  title,
  body,
  labels,
}: CreateIssueOpts): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const args = ["issue", "create", "-R", `${owner}/${repo}`, "--title", title];

  if (body) args.push("--body", body);
  if (labels && labels.length > 0) args.push("--label", labels.join(","));

  return ghCmd(args);
}

export function createIssueColumns(): Column[] {
  return createBasicColumns((r) => {
    const parts = [`${r.author} · ${r.date}`, r.url];
    if (r.labels) parts.unshift(r.labels);
    return parts.join("\n");
  });
}

export function createIssueRowMapper() {
  return (issue: GHIssue) => ({
    "#": `#${issue.number}`,
    title: issue.title,
    state: issue.state,
    author: issue.author?.login ?? "",
    date: new Date(issue.createdAt).toLocaleDateString(),
    labels: issue.labels?.map((l) => l.name).join(", ") ?? "",
    url: issue.html_url,
  });
}

export function createIssueFields() {
  return (issue: GHIssue) => [
    { label: "title", value: `#${issue.number} ${issue.title}` },
    { label: "state", value: issue.state },
    { label: "author", value: issue.author?.login ?? "unknown" },
    {
      label: "labels",
      value: issue.labels?.map((l) => l.name).join(", ") || "none",
    },
    { label: "milestone", value: issue.milestone?.title || "none" },
    {
      label: "created",
      value: new Date(issue.createdAt).toLocaleString(),
    },
    { label: "url", value: issue.html_url },
  ];
}
