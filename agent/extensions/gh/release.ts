import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import {
  dotJoin,
  table,
  detail,
  stateDot,
  type Column,
} from "../../shared/renderers";
import { ghCmd } from "./utils";
import {
  createListRenderCall,
  createTextResultRender,
  createViewRenderCall,
} from "./shared";

export interface GHRelease {
  tagName: string;
  name: string;
  publishedAt: string;
  url: string;
  draft: boolean;
  isPrerelease: boolean;
  assets: {
    name: string;
    url: string;
    size: number;
    downloadCount: number;
  }[];
}

export async function listReleases(
  owner: string,
  repo: string,
  limit = 30,
): Promise<GHRelease[]> {
  const args = [
    "release",
    "list",
    "-R",
    `${owner}/${repo}`,
    `--limit=${limit}`,
    "--json=tagName,name,publishedAt,isDraft,isPrerelease",
    "--jq",
    '[.[] | {tagName, name, publishedAt, url: "", draft: .isDraft, isPrerelease, assets: []}]',
  ];

  const result = await ghCmd(args);

  if (result.exitCode !== 0)
    throw new Error(
      `gh release list failed: ${result.stderr || result.stdout}`,
    );

  let releases: GHRelease[];
  try {
    releases = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh release list output: ${result.stdout}`);
  }

  return releases;
}

export async function viewRelease(
  owner: string,
  repo: string,
  tag: string,
): Promise<GHRelease> {
  const result = await ghCmd([
    "release",
    "view",
    tag,
    "-R",
    `${owner}/${repo}`,
    "--json=tagName,name,publishedAt,url,isDraft,isPrerelease,assets",
    "--jq",
    "{tagName, name, publishedAt, url, draft: .isDraft, isPrerelease, assets}",
  ]);

  if (result.exitCode !== 0)
    throw new Error(
      `gh release view failed: ${result.stderr || result.stdout}`,
    );

  let release: GHRelease;
  try {
    release = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse gh release view output: ${result.stdout}`);
  }

  return release;
}

function createErrorResult(
  message: string,
): AgentToolResult<{ error?: string }> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
}

export const ListReleasesParams = Type.Object({
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
      description: "Maximum number of releases to return (max 100)",
    }),
  ),
});

export const ViewReleaseParams = Type.Object({
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repo: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  tag: Type.String({
    description: "Release tag name (e.g., 'v1.0.0', 'v2.1.3')",
  }),
});

export type ListReleasesParamsType = Static<typeof ListReleasesParams>;
export type ViewReleaseParamsType = Static<typeof ViewReleaseParams>;

function createListReleasesTool() {
  return {
    name: "gh-list-releases",
    label: "List Releases",
    description: `List releases in a GitHub repository.

Use this to:
- View all published releases and versions
- Find release dates and version tags
- Check for pre-release or draft releases
- Discover available download assets

Examples:
- gh-list-releases(owner='facebook', repo='react')
- gh-list-releases(owner='microsoft', repo='vscode', limit=50)
- gh-list-releases(owner='golang', repo='go', limit=10)`,
    parameters: ListReleasesParams,
    async execute(
      _id: string,
      params: ListReleasesParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        return await executeListReleases(params);
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall: createListRenderCall("gh-list-releases"),
    renderResult: createTextResultRender(),
  };
}

async function executeListReleases(
  params: ListReleasesParamsType,
): Promise<AgentToolResult<{ releases: GHRelease[] }>> {
  const releases = await listReleases(params.owner, params.repo, params.limit);
  const cols: Column[] = [
    { key: "tag", minWidth: 15 },
    {
      key: "info",
      format(_v, row) {
        const r = row as Record<string, string>;
        const flags = [
          r.draft === "true" ? "draft" : "",
          r.prerelease === "true" ? "pre-release" : "",
        ]
          .filter(Boolean)
          .join(", ");
        return [r.name, flags ? `[${flags}]` : "", r.date]
          .filter(Boolean)
          .join(" · ");
      },
    },
  ];
  const rows = releases.map((r) => ({
    tag: r.tagName,
    name: r.name || r.tagName,
    draft: String(r.draft),
    prerelease: String(r.isPrerelease),
    date: r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : "",
  }));
  return {
    content: [
      {
        type: "text",
        text: [
          dotJoin(`${releases.length} releases`),
          "",
          table(cols, rows),
        ].join("\n"),
      },
    ],
    details: { releases },
  };
}

async function executeViewRelease(
  params: ViewReleaseParamsType,
): Promise<AgentToolResult<{ release: GHRelease }>> {
  const release = await viewRelease(params.owner, params.repo, params.tag);
  const fields = [
    { label: "tag", value: release.tagName },
    { label: "name", value: release.name || release.tagName },
    {
      label: "published",
      value: release.publishedAt
        ? new Date(release.publishedAt).toLocaleString()
        : "unpublished",
    },
    { label: "draft", value: `${stateDot(release.draft)} draft` },
    {
      label: "prerelease",
      value: `${stateDot(release.isPrerelease)} prerelease`,
    },
    { label: "url", value: release.url ? release.url : "" },
    {
      label: "assets",
      value: release.assets?.length
        ? release.assets
            .map((a) => `${a.name} (${(a.size / 1024).toFixed(1)} KB)`)
            .join(", ")
        : "none",
    },
  ];
  return {
    content: [{ type: "text", text: detail(fields) }],
    details: { release },
  };
}

function createViewReleaseTool() {
  return {
    name: "gh-view-release",
    label: "View Release",
    description: `View details of a specific release.

Use this to:
- Read release notes and changelogs
- See release metadata (draft, prerelease status)
- List available download assets
- Check publication date

Examples:
- gh-view-release(owner='facebook', repo='react', tag='v18.2.0')
- gh-view-release(owner='microsoft', repo='vscode', tag='1.85.0')
- gh-view-release(owner='golang', repo='go', tag='go1.21.0')`,
    parameters: ViewReleaseParams,
    async execute(
      _id: string,
      params: ViewReleaseParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        return await executeViewRelease(params);
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    renderCall: createViewRenderCall("gh-view-release"),
    renderResult: createTextResultRender(),
  };
}

export function registerReleaseTools(pi: ExtensionAPI) {
  pi.registerTool(createListReleasesTool());
  pi.registerTool(createViewReleaseTool());
}
