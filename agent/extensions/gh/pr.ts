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

export interface GHPR {
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

export async function listPRs(
  owner: string,
  repo: string,
  state?: "open" | "closed" | "merged" | "all",
  limit = 30,
): Promise<GHPR[]> {
  const args = ["pr", "list", "-R", `${owner}/${repo}`, `--limit=${limit}`];
  if (state && state !== "all") {
    args.push(`--state=${state}`);
  }
  args.push(
    "--json=number,title,state,createdAt,updatedAt,baseRefName,headRefName,author,url,mergeable,reviewDecision",
    "--jq",
    "[.[] | . + {html_url: .url}]",
  );

  const result = await ghCmd(args);

  if (result.exitCode !== 0) {
    throw new Error(`gh pr list failed: ${result.stderr || result.stdout}`);
  }

  let prs: GHPR[];
  try {
    prs = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh pr list output: ${result.stdout}`);
  }

  return prs;
}

export async function viewPR(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GHPR> {
  const result = await ghCmd([
    "pr",
    "view",
    `${prNumber}`,
    "-R",
    `${owner}/${repo}`,
    "--json=number,title,state,createdAt,updatedAt,baseRefName,headRefName,author,body,url,mergeable,reviewDecision,mergeCommit,isCrossRepository",
    "--jq",
    ". + {html_url: .url}",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`gh pr view failed: ${result.stderr || result.stdout}`);
  }

  let pr: GHPR;
  try {
    pr = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh pr view output: ${result.stdout}`);
  }

  return pr;
}

export async function createPR(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  head?: string,
  base?: string,
  draft?: boolean,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["pr", "create", "-R", `${owner}/${repo}`, "--title", title];

  if (body) {
    args.push("--body", body);
  }
  if (head) {
    args.push("--head", head);
  }
  if (base) {
    args.push("--base", base);
  }
  if (draft) {
    args.push("--draft");
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

export const ListPRsParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  state: Type.Optional(
    Type.Union(
      [
        Type.Literal("open"),
        Type.Literal("closed"),
        Type.Literal("merged"),
        Type.Literal("all"),
      ],
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
      description: "Maximum number of PRs to return (max 100)",
    }),
  ),
});

export const ViewPRParams = Type.Object({
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

export const CreatePRParams = Type.Object({
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

export type ListPRsParamsType = Static<typeof ListPRsParams>;
export type ViewPRParamsType = Static<typeof ViewPRParams>;
export type CreatePRParamsType = Static<typeof CreatePRParams>;

export function registerPRTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh-list-prs",
    label: "List Pull Requests",
    description: `List pull requests in a GitHub repository.

Use this to:
- View open, closed, or merged PRs
- Track pending reviews and changes
- Monitor PR activity in a repository
- Find PRs by state

Examples:
- gh-list-prs(owner='facebook', repo='react')
- gh-list-prs(owner='microsoft', repo='vscode', state='open', limit=50)
- gh-list-prs(owner='torvalds', repo='linux', state='merged')`,
    parameters: ListPRsParams as any,
    async execute(
      _id,
      params: ListPRsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const prs = await listPRs(
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
              return [
                `${dot} ${r.title}`,
                `${r.base} ← ${r.head} · ${r.author} · ${r.date}`,
                r.url,
              ].join("\n");
            },
          },
        ];
        const rows = prs.map((pr) => ({
          "#": `#${pr.number}`,
          title: pr.title,
          state: pr.state,
          base: pr.baseRefName,
          head: pr.headRefName,
          author: pr.author?.login ?? "",
          date: new Date(pr.createdAt).toLocaleDateString(),
          url: pr.html_url,
        }));
        return {
          content: [
            {
              type: "text",
              text: [dotJoin(`${prs.length} PRs`), "", table(cols, rows)].join(
                "\n",
              ),
            },
          ],
          details: { prs },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-list-prs"));
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
    name: "gh-view-pr",
    label: "View Pull Request",
    description: `View details of a specific pull request.

Use this to:
- Read the full PR description and changes
- See PR metadata (author, branches, merge status)
- Check review status and mergeability
- Access the PR URL

Examples:
- gh-view-pr(owner='facebook', repo='react', number=123)
- gh-view-pr(owner='microsoft', repo='vscode', number=456)`,
    parameters: ViewPRParams as any,
    async execute(
      _id,
      params: ViewPRParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const pr = await viewPR(params.owner, params.repo, params.number);
        const fields = [
          { label: "title", value: `#${pr.number} ${pr.title}` },
          { label: "state", value: pr.state },
          { label: "author", value: pr.author?.login ?? "unknown" },
          { label: "branch", value: `${pr.baseRefName} ← ${pr.headRefName}` },
          { label: "mergeable", value: pr.mergeable },
          { label: "review", value: pr.reviewDecision || "none" },
          { label: "created", value: new Date(pr.createdAt).toLocaleString() },
          { label: "url", value: pr.html_url },
        ];
        const output = [detail(fields), pr.body ? `\n${pr.body}` : ""].join("");
        return { content: [{ type: "text", text: output }], details: { pr } };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("gh-view-pr"));
      if (args.owner && args.repo)
        text += theme.fg("muted", ` ${args.owner}/${args.repo}#${args.number}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "gh-create-pr",
    label: "Create Pull Request",
    description: `Create a new pull request.

Use this to:
- Submit code changes for review
- Propose new features or fixes
- Create draft PRs for work in progress
- Merge branches together

Examples:
- gh-create-pr(owner='facebook', repo='react', title='Fix bug', head='fix-branch', base='main')
- gh-create-pr(owner='microsoft', repo='vscode', title='New feature', body='Description...', draft=true)
- gh-create-pr(owner='torvalds', repo='linux', title='Kernel patch', head='feature')`,
    parameters: CreatePRParams as any,
    async execute(
      _id,
      params: CreatePRParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      ctx: ExtensionContext,
    ) {
      if (!ctx) return createErrorResult("Blocked: no context");
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Create PR",
        `"${params.title}" in ${params.owner}/${params.repo}`,
      );
      if (denied) return denied;
      try {
        const result = await createPR(
          params.owner,
          params.repo,
          params.title,
          params.body,
          params.head,
          params.base,
          params.draft,
        );
        if (result.exitCode !== 0)
          return createErrorResult(result.stderr || result.stdout);
        return {
          content: [
            { type: "text", text: `✓ PR created\n${result.stdout.trim()}` },
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
      let text = theme.fg("toolTitle", theme.bold("gh-create-pr"));
      if (args.title) text += theme.fg("muted", ` "${args.title}"`);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });
}
