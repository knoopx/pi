import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { dangerousOperationConfirmation } from "../../shared/tool-utils";
import { renderTextToolResult } from "../../shared/render-utils";
import { dotJoin, table, detail, type Column } from "../../shared/renderers";
import { ghCmd } from "./utils";

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
  state?: "open" | "closed" | "all",
  limit = 30,
): Promise<GHIssue[]> {
  const args = ["issue", "list", "-R", `${owner}/${repo}`, `--limit=${limit}`];
  if (state && state !== "all") {
    args.push(`--state=${state}`);
  }
  args.push(
    "--json=number,title,state,createdAt,updatedAt,author,body,url,labels,milestone",
    "--jq",
    "[.[] | . + {html_url: .url}]",
  );

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    throw new Error(`gh issue list failed: ${result.stderr || result.stdout}`);
  }

  let issues: GHIssue[];
  try {
    issues = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh issue list output: ${result.stdout}`);
  }

  return issues;
}

export async function viewIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GHIssue> {
  const result = await ghCmd([
    "issue",
    "view",
    `${issueNumber}`,
    "-R",
    `${owner}/${repo}`,
    "--json=number,title,state,createdAt,updatedAt,author,body,url,labels,milestone",
    "--jq",
    ". + {html_url: .url}",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh issue view failed: ${result.stderr || result.stdout}`);
  }

  let issue: GHIssue;
  try {
    issue = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh issue view output: ${result.stdout}`);
  }

  return issue;
}

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["issue", "create", "-R", `${owner}/${repo}`, "--title", title];

  if (body) {
    args.push("--body", body);
  }
  if (labels && labels.length > 0) {
    args.push("--label", labels.join(","));
  }

  return ghCmd(args);
}

function createErrorResult(
  message: string,
): AgentToolResult<{ error?: string }> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
}

export const ListIssuesParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  state: Type.Optional(
    Type.Union(
      [Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")],
      {
        description: "Filter by state (default: open)",
      },
    ),
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 30,
      description: "Maximum number of issues to return (max 100)",
    }),
  ),
});

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
  pi.registerTool({
    name: "gh-list-issues",
    label: "List Issues",
    description: `List issues in a GitHub repository.

Use this to:
- View open or closed issues in a repository
- Filter issues by state (open/closed/all)
- Track bug reports and feature requests
- Monitor issue activity

Examples:
- gh-list-issues(owner='facebook', repo='react')
- gh-list-issues(owner='microsoft', repo='vscode', state='open', limit=50)
- gh-list-issues(owner='torvalds', repo='linux', state='closed')`,
    parameters: ListIssuesParams as any,
    async execute(
      _id,
      params: ListIssuesParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const issues = await listIssues(
          params.owner,
          params.repo,
          params.state,
          params.limit,
        );
        const cols: Column[] = [
          { key: "#", align: "right", minWidth: 5 },
          {
            key: "title",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              const dot = r.state === "OPEN" ? "●" : "○";
              const lines = [`${dot} ${r.title}`];
              if (r.labels) lines.push(r.labels);
              lines.push(`${r.author} · ${r.date}`, r.url);
              return lines.join("\n");
            },
          },
        ];
        const rows = issues.map((issue) => ({
          "#": `#${issue.number}`,
          title: issue.title,
          state: issue.state,
          author: issue.author?.login ?? "",
          date: new Date(issue.createdAt).toLocaleDateString(),
          labels: issue.labels?.map((l) => l.name).join(", ") ?? "",
          url: issue.html_url,
        }));
        return {
          content: [
            {
              type: "text",
              text: [
                dotJoin(`${issues.length} issues`),
                "",
                table(cols, rows),
              ].join("\n"),
            },
          ],
          details: { issues },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-issues"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}`);
      if (args.state) text += theme.fg("dim", ` --state=${args.state}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-view-issue",
    label: "View Issue",
    description: `View details of a specific issue.

Use this to:
- Read the full issue content and description
- See issue metadata (author, labels, milestone)
- Check issue state and creation date
- Access the issue URL

Examples:
- gh-view-issue(owner='facebook', repo='react', number=123)
- gh-view-issue(owner='microsoft', repo='vscode', number=456)`,
    parameters: ViewIssueParams as any,
    async execute(
      _id,
      params: ViewIssueParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const issue = await viewIssue(params.owner, params.repo, params.number);
        const fields = [
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
        const output = [
          detail(fields),
          issue.body ? `\n${issue.body}` : "",
        ].join("");
        return {
          content: [{ type: "text", text: output }],
          details: { issue },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-view-issue"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}#${args.number}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-create-issue",
    label: "Create Issue",
    description: `Create a new issue in a repository.

Use this to:
- Report bugs or problems
- Request new features
- Ask questions about the project
- Track tasks and to-dos

Examples:
- gh-create-issue(owner='facebook', repo='react', title='Bug: Component crashes')
- gh-create-issue(owner='microsoft', repo='vscode', title='Feature request', body='Would love to see...')
- gh-create-issue(owner='torvalds', repo='linux', title='Kernel issue', labels=['bug', 'high-priority'])`,
    parameters: CreateIssueParams as any,
    async execute(
      _id,
      params: CreateIssueParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      ctx: ExtensionContext,
    ) {
      if (!ctx) return createErrorResult("Blocked: no context");
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Create Issue",
        `"${params.title}" in ${params.owner}/${params.repo}`,
      );
      if (denied) return denied;
      try {
        const result = await createIssue(
          params.owner,
          params.repo,
          params.title,
          params.body,
          params.labels,
        );
        if (result.exitCode !== 0)
          return createErrorResult(result.stderr || result.stdout);
        return {
          content: [
            { type: "text", text: `✓ Issue created\n${result.stdout.trim()}` },
          ],
          details: { stdout: result.stdout },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-create-issue"));
      if (args.title) text += theme.fg("muted", ` "${args.title}"`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });
}
