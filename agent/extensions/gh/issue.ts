import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import { type Column } from "../../shared/renderers";
import { ghCmd, ghCmdJson } from "./utils";
import {
  createListParamsSchema,
  registerListTool,
  registerViewTool,
  registerCreateTool,
} from "./shared";

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
}

export async function listIssues(
  owner: string,
  repo: string,
  state?: "open" | "closed" | "merged" | "all",
  limit = 30,
): Promise<GHIssue[]> {
  const args: string[] = [
    "issue",
    "list",
    "-R",
    `${owner}/${repo}`,
    `--limit=${limit}`,
  ];
  if (state && state !== "all") args.push(`--state=${state}`);
  args.push(
    "--json=number,title,state,createdAt,updatedAt,author,body,url,labels,milestone",
    "--jq",
    "[.[] | . + {html_url: .url}]",
  );

  return ghCmdJson<GHIssue[]>(args, "issue list");
}

export async function viewIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GHIssue> {
  return ghCmdJson<GHIssue>(
    [
      "issue",
      "view",
      `${issueNumber}`,
      "-R",
      `${owner}/${repo}`,
      "--json=number,title,state,createdAt,updatedAt,author,body,url,labels,milestone",
      "--jq",
      ". + {html_url: .url}",
    ],
    "issue view",
  );
}

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["issue", "create", "-R", `${owner}/${repo}`, "--title", title];

  if (body) args.push("--body", body);
  if (labels && labels.length > 0) args.push("--label", labels.join(","));

  return ghCmd(args);
}

export const ListIssuesParams = createListParamsSchema(
  "List issues in a GitHub repository",
  ["open", "closed", "all"],
  "issues",
);

export const ViewIssueParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  number: Type.Integer({
    description: "Issue number (e.g., 123)",
  }),
});

export const CreateIssueParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  title: Type.String({
    description: "Issue title",
  }),
  body: Type.Optional(
    Type.String({
      description: "Issue body in markdown format (optional)",
    }),
  ),
  labels: Type.Optional(
    Type.Array(Type.String(), {
      description: "Array of label names to attach to the issue",
    }),
  ),
});

export type ListIssuesParamsType = Static<typeof ListIssuesParams>;
export type ViewIssueParamsType = Static<typeof ViewIssueParams>;
export type CreateIssueParamsType = Static<typeof CreateIssueParams>;

export function registerIssueTools(pi: ExtensionAPI) {
  const issueColumns: Column[] = [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format(_v, row) {
        const r = row as Record<string, string>;
        const dot = r.state === "OPEN" ? "●" : "○";
        const lines = [`${dot} ${r.title}`];
        if (r.labels) lines.push(r.labels);
        lines.push(`${r.author} · ${r.date}`, r.url);
        return lines.join("\n");
      },
    },
  ];

  const issueRowMapper = (issue: GHIssue) => ({
    "#": `#${issue.number}`,
    title: issue.title,
    state: issue.state,
    author: issue.author?.login ?? "",
    date: new Date(issue.createdAt).toLocaleDateString(),
    labels: issue.labels?.map((l) => l.name).join(", ") ?? "",
    url: issue.html_url,
  });

  const issueFields = (issue: GHIssue) => [
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

  registerListTool(pi, {
    toolName: "gh-list-issues",
    toolLabel: "Issues",
    toolDescription: `List issues in a GitHub repository.

Use this to:
- View open or closed issues in a repository
- Filter issues by state (open/closed/all)
- Track bug reports and feature requests
- Monitor issue activity

Examples:
- gh-list-issues(owner='facebook', repo='react')
- gh-list-issues(owner='microsoft', repo='vscode', state='open', limit=50)
- gh-list-issues(owner='torvalds', repo='linux', state='closed')`,
    paramsSchema: ListIssuesParams,
    listFn: listIssues,
    columns: issueColumns,
    rowMapper: issueRowMapper,
  });

  registerViewTool(pi, {
    toolName: "gh-view-issue",
    toolLabel: "Issue",
    toolDescription: `View details of a specific issue.

Use this to:
- Read the full issue content and description
- See issue metadata (author, labels, milestone)
- Check issue state and creation date
- Access the issue URL

Examples:
- gh-view-issue(owner='facebook', repo='react', number=123)
- gh-view-issue(owner='microsoft', repo='vscode', number=456)`,
    paramsSchema: ViewIssueParams,
    viewFn: viewIssue,
    fields: issueFields,
    includeBody: true,
  });

  registerCreateTool(pi, {
    toolName: "gh-create-issue",
    toolLabel: "Create Issue",
    toolDescription: `Create a new issue in a repository.

Use this to:
- Report bugs or problems
- Request new features
- Ask questions about the project
- Track tasks and to-dos

Examples:
- gh-create-issue(owner='facebook', repo='react', title='Bug: Component crashes')
- gh-create-issue(owner='microsoft', repo='vscode', title='Feature request', body='Would love to see...')
- gh-create-issue(owner='torvalds', repo='linux', title='Kernel issue', labels=['bug', 'high-priority'])`,
    paramsSchema: CreateIssueParams,
    createFn: (params: CreateIssueParamsType) =>
      createIssue(
        params.owner,
        params.repo,
        params.title,
        params.body,
        params.labels,
      ),
    confirmationTitle: "Create Issue",
    confirmationDescription: (params) =>
      `"${params.title}" in ${params.owner}/${params.repo}`,
    successMessagePrefix: "✓ Issue created",
  });
}
