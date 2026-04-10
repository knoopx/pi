import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import { dotJoin, table, stateDot, type Column } from "../../shared/renderers";
import { ghCmd } from "./utils";
import { createListRenderCall, createTextResultRender } from "./shared";

export interface GHWorkflow {
  name: string;
  id: number;
  state: string;
  path: string;
}

export interface GHWorkflowRun {
  workflow_name: string;
  status: string;
  conclusion: string;
  headBranch: string;
  headCommit: string;
  title: string;
  createdAt: string;
  url: string;
}

async function ghList<T>(args: string[], errorBase: string): Promise<T[]> {
  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    throw new Error(`${errorBase} failed: ${result.stderr || result.stdout}`);
  }

  let items: T[];
  try {
    items = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse ${errorBase} output: ${result.stdout}`);
  }

  return items;
}

export async function listWorkflows(
  owner: string,
  repo: string,
  limit = 30,
): Promise<GHWorkflow[]> {
  return ghList<GHWorkflow>(
    [
      "workflow",
      "list",
      "-R",
      `${owner}/${repo}`,
      `--limit=${limit}`,
      "--json=name,id,state,path",
    ],
    "gh workflow list",
  );
}

export async function listWorkflowRuns(
  owner: string,
  repo: string,
  workflowId?: number | string,
  limit = 30,
): Promise<GHWorkflowRun[]> {
  const args = ["run", "list", "-R", `${owner}/${repo}`, `--limit=${limit}`];

  if (workflowId) {
    args.push(`--workflow=${workflowId}`);
  }

  args.push(
    "--json=workflowName,status,conclusion,headBranch,headSha,displayTitle,createdAt,url",
    "--jq",
    "[.[] | {workflow_name: .workflowName, status, conclusion, headBranch, headCommit: .headSha, title: .displayTitle, createdAt, url}]",
  );

  return ghList<GHWorkflowRun>(args, "gh run list");
}

function createErrorResult(
  message: string,
): AgentToolResult<{ error?: string }> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
}

export const ListWorkflowsParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 30,
      description: "Maximum number of workflows to return (max 100)",
    }),
  ),
});

export const ListRunsParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  workflow: Type.Optional(
    Type.String({
      description:
        "Filter by workflow ID (numeric) or workflow filename (e.g., 'ci.yml')",
    }),
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 30,
      description: "Maximum number of workflow runs to return (max 100)",
    }),
  ),
});

export type ListWorkflowsParamsType = Static<typeof ListWorkflowsParams>;
export type ListRunsParamsType = Static<typeof ListRunsParams>;

export function registerWorkflowTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh-list-workflows",
    label: "List Workflows",
    description: `List GitHub Actions workflows in a repository.

Use this to:
- Discover all CI/CD workflows configured in a repository
- Check workflow status (active/inactive)
- Find workflow file paths and IDs
- Explore automation setups

Examples:
- gh-list-workflows(owner='facebook', repo='react')
- gh-list-workflows(owner='microsoft', repo='vscode', limit=50)
- gh-list-workflows(owner='golang', repo='go', limit=20)`,
    parameters: ListWorkflowsParams,
    async execute(
      _id,
      params: ListWorkflowsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const workflows = await listWorkflows(
          params.owner,
          params.repo,
          params.limit,
        );
        const cols: Column[] = [
          { key: "id", align: "right", minWidth: 8 },
          {
            key: "info",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              const dot =
                r.state === "active" ? stateDot("on") : stateDot("off");
              return [`${dot} ${r.name}`, r.path].join("\n");
            },
          },
        ];
        const rows = workflows.map((w) => ({
          id: String(w.id),
          name: w.name,
          state: w.state,
          path: w.path,
        }));
        return {
          content: [
            {
              type: "text",
              text: [
                dotJoin(`${workflows.length} workflows`),
                "",
                table(cols, rows),
              ].join("\n"),
            },
          ],
          details: { workflows },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall: createListRenderCall("gh-list-workflows"),
    renderResult: createTextResultRender(),
  });

  pi.registerTool({
    name: "gh-list-runs",
    label: "List Workflow Runs",
    description: `List recent GitHub Actions workflow runs.

Use this to:
- View recent CI/CD job executions
- Check build/test status and results
- Filter runs by specific workflow
- Track workflow history

Examples:
- gh-list-runs(owner='facebook', repo='react')
- gh-list-runs(owner='microsoft', repo='vscode', workflow='ci.yml', limit=50)
- gh-list-runs(owner='golang', repo='go', limit=20)`,
    parameters: ListRunsParams,
    async execute(
      _id,
      params: ListRunsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const runs = await listWorkflowRuns(
          params.owner,
          params.repo,
          params.workflow,
          params.limit,
        );
        const cols: Column[] = [
          { key: "status", minWidth: 3 },
          {
            key: "info",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              return [r.title, `${r.workflow} · ${r.branch} · ${r.date}`].join(
                "\n",
              );
            },
          },
        ];
        const rows = runs.map((r) => ({
          status:
            r.conclusion === "success"
              ? "✓"
              : r.conclusion === "failure"
                ? "✗"
                : "●",
          title: r.title,
          workflow: r.workflow_name,
          branch: r.headBranch,
          date: new Date(r.createdAt).toLocaleDateString(),
        }));
        return {
          content: [
            {
              type: "text",
              text: [
                dotJoin(`${runs.length} runs`),
                "",
                table(cols, rows),
              ].join("\n"),
            },
          ],
          details: { runs },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall: createListRenderCall("gh-list-runs"),
    renderResult: createTextResultRender(),
  });
}
