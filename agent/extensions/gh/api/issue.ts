import { ghCmd, ghCmdJson } from "../../../shared/process/gh-cmd";
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

export interface GHIssueComment {
  id: string;
  body: string;
  createdAt: string;
  author: { login: string; avatar_url: string; html_url: string } | null;
}

export interface GHIssue {
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
  comments: GHIssueComment[];
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

async function fetchIssueComments(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GHIssueComment[]> {
  return ghCmdJson<GHIssueComment[]>(
    [
      "api",
      `repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      "--jq", "[.[] | {id: .node_id, body: .body, createdAt: .created_at, author: {login: .user.login, avatar_url: .user.avatar_url, html_url: .user.html_url}}]",
    ],
    "issue comments",
  );
}

export async function viewIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GHIssue> {
  const issue = await viewResource<GHIssue>(
    buildViewArgs("issue", owner, repo, issueNumber, ISSUE_JSON_FIELDS),
    "issue view",
  );
  const comments = await fetchIssueComments(owner, repo, issueNumber);
  return { ...issue, comments };
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

function formatIssueLabels(labels: GHIssue["labels"]): string {
  return labels?.map((l) => l.name).join(", ") || "none";
}

function formatComments(comments: GHIssueComment[]): string {
  if (!comments || comments.length === 0) return "none";
  const lines = comments.map((c) => {
    const author = c.author?.login ?? "unknown";
    const date = new Date(c.createdAt).toLocaleString();
    return `@${author} (${date})\n${c.body}`;
  });
  return lines.join("\n---\n");
}

export function createIssueFields() {
  return (issue: GHIssue) => [
    { label: "title", value: `#${issue.number} ${issue.title}` },
    { label: "state", value: issue.state },
    { label: "author", value: issue.author?.login ?? "unknown" },
    { label: "labels", value: formatIssueLabels(issue.labels) },
    { label: "milestone", value: issue.milestone?.title || "none" },
    {
      label: "created",
      value: new Date(issue.createdAt).toLocaleString(),
    },
    { label: "url", value: issue.html_url },
    {
      label: "comments",
      value: formatComments(issue.comments),
    },
  ];
}
