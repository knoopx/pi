import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  registerListTool,
  registerViewTool,
  registerCreateTool,
} from "../lib/registration";
import { ViewParamsSchema, createListParamsSchema } from "../lib/types";
import {
  listPRs,
  viewPR,
  createPR,
  createPrColumns,
  createPrRowMapper,
  createPrFields,
} from "../api/pr";

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
    toolDescription: `List pull requests in a GitHub repository.`,
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
    toolDescription: `View details of a specific pull request.`,
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
    toolDescription: `Create a new pull request.`,
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
