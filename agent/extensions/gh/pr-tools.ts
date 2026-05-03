import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  createListParamsSchema,
  ViewParamsSchema,
  registerListTool,
  registerViewTool,
  registerCreateTool,
} from "./shared";
import {
  listPRs,
  viewPR,
  createPR,
  createPrColumns,
  createPrRowMapper,
  createPrFields,
} from "./pr-api";

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
    paramsSchema: createListParamsSchema(
      "List pull requests in a GitHub repository",
      ["open", "closed", "merged", "all"],
      "PRs",
    ),
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
    paramsSchema: ViewParamsSchema,
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
    createFn: (params: {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      head?: string;
      base?: string;
      draft?: boolean;
    }) =>
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
