import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import type { Column } from "../../shared/renderers";

import { ghCmd, ghCmdJson } from "./utils";
import {
  createBasicColumns,
  createListParamsSchema,
  registerListTool,
  registerViewTool,
  registerCreateTool,
} from "./shared";

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

function listPRs(
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

function viewPR(owner: string, repo: string, prNumber: number): Promise<GHPR> {
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

function createPR({
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

const ListPRsParams = createListParamsSchema(
  "List pull requests in a GitHub repository",
  ["open", "closed", "merged", "all"],
  "PRs",
);

const ViewPRParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  number: Type.Integer({
    description: "PR number (e.g., 123)",
  }),
});

const CreatePRParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  title: Type.String({
    description: "PR title",
  }),
  body: Type.Optional(
    Type.String({
      description: "PR body/description in markdown format (optional)",
    }),
  ),
  head: Type.Optional(
    Type.String({
      description:
        "Name of the branch containing changes (e.g., 'feature-branch')",
    }),
  ),
  base: Type.Optional(
    Type.String({
      description: "Name of the branch to merge into (e.g., 'main')",
    }),
  ),
  draft: Type.Optional(
    Type.Boolean({
      description: "Create as a draft PR (default: false)",
      default: false,
    }),
  ),
});

type CreatePRParamsType = Static<typeof CreatePRParams>;

function createPrColumns(): Column[] {
  return createBasicColumns(
    (r) => `${r.base} ← ${r.head} · ${r.author} · ${r.date}\n${r.url}`,
  );
}

function createPrRowMapper() {
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

function createPrFields() {
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

function createListPRsTool() {
  return {
    toolName: "gh-list-prs",
    toolLabel: "PRs",
    toolDescription: `List pull requests in a GitHub repository.

Use this to:
- View open, closed, or merged PRs
- Track pending reviews and changes
- Monitor PR activity in a repository
- Find PRs by state

Examples:
- gh-list-prs(owner='facebook', repo='react')
- gh-list-prs(owner='microsoft', repo='vscode', state='open', limit=50)
- gh-list-prs(owner='torvalds', repo='linux', state='merged')`,
    paramsSchema: ListPRsParams,
    listFn: listPRs,
    columns: createPrColumns(),
    rowMapper: createPrRowMapper(),
  };
}

function createViewPRTool() {
  return {
    toolName: "gh-view-pr",
    toolLabel: "Pull Request",
    toolDescription: `View details of a specific pull request.

Use this to:
- Read the full PR description and changes
- See PR metadata (author, branches, merge status)
- Check review status and mergeability
- Access the PR URL

Examples:
- gh-view-pr(owner='facebook', repo='react', number=123)
- gh-view-pr(owner='microsoft', repo='vscode', number=456)`,
    paramsSchema: ViewPRParams,
    viewFn: viewPR,
    fields: createPrFields(),
    includeBody: true,
  };
}

function createCreatePRTool() {
  return {
    toolName: "gh-create-pr",
    toolLabel: "Create Pull Request",
    toolDescription: `Create a new pull request.

Use this to:
- Submit code changes for review
- Propose new features or fixes
- Create draft PRs for work in progress
- Merge branches together

Examples:
- gh-create-pr(owner='facebook', repo='react', title='Fix bug', head='fix-branch', base='main')
- gh-create-pr(owner='microsoft', repo='vscode', title='New feature', body='Description...', draft=true)
- gh-create-pr(owner='torvalds', repo='linux', title='Kernel patch', head='feature')`,
    paramsSchema: CreatePRParams,
    createFn: (
      params: CreatePRParamsType,
    ): Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }> =>
      createPR({
        owner: params.owner,
        repo: params.repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
        draft: params.draft,
      }),
    confirmationTitle: "Create PR",
    confirmationDescription: (params: {
      owner: string;
      repo: string;
      title: string;
    }) => `"${params.title}" in ${params.owner}/${params.repo}`,
    successMessagePrefix: "✓ PR created",
  };
}

export function registerPRTools(pi: ExtensionAPI) {
  registerListTool(pi, createListPRsTool());
  registerViewTool(pi, createViewPRTool());
  registerCreateTool(pi, createCreatePRTool());
}
