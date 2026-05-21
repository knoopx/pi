import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  registerListTool,
  registerViewTool,
  registerCreateTool,
} from "../lib/registration";
import { ViewParamsSchema, createListParamsSchema } from "../lib/types";
import {
  listIssues,
  viewIssue,
  createIssue,
  createIssueColumns,
  createIssueRowMapper,
  createIssueFields,
} from "../api/issue";

const CreateIssueParams = Type.Object({
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

function createListIssuesTool() {
  return {
    toolName: "gh-list-issues",
    toolLabel: "Issues",
    toolDescription: `List issues in a GitHub repository.`,
    paramsSchema: createListParamsSchema(
      "List issues in a GitHub repository",
      ["open", "closed", "all"],
      "issues",
    ),
    listFn: listIssues,
    columns: createIssueColumns(),
    rowMapper: createIssueRowMapper(),
  };
}

function createViewIssueTool() {
  return {
    toolName: "gh-view-issue",
    toolLabel: "Issue",
    toolDescription: `View details of a specific issue.`,
    paramsSchema: ViewParamsSchema,
    viewFn: viewIssue,
    fields: createIssueFields(),
    includeBody: true,
  };
}

function createCreateIssueTool() {
  return {
    toolName: "gh-create-issue",
    toolLabel: "Create Issue",
    toolDescription: `Create a new issue in a repository.`,
    paramsSchema: CreateIssueParams,
    createFn: (params: {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      labels?: string[];
    }) =>
      createIssue({
        owner: params.owner,
        repo: params.repo,
        title: params.title,
        body: params.body,
        labels: params.labels,
      }),
    confirmationTitle: "Create Issue",
    confirmationDescription: (params: {
      owner: string;
      repo: string;
      title: string;
    }) => `"${params.title}" in ${params.owner}/${params.repo}`,
    successMessagePrefix: "✓ Issue created",
  };
}

export function registerIssueTools(pi: ExtensionAPI) {
  registerListTool(pi, createListIssuesTool());
  registerViewTool(pi, createViewIssueTool());
  registerCreateTool(pi, createCreateIssueTool());
}
