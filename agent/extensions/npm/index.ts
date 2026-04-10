import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import { textResult } from "../../shared/tool-utils";
import { throttledFetch } from "../../shared/throttle";
import { dotJoin, countLabel, table, detail } from "../../shared/renderers";
import type { Column } from "../../shared/renderers";

// Parameter schemas
const SearchNpmPackagesParams = Type.Object({
  query: Type.String({ description: "Search query for npm packages" }),
  size: Type.Optional(
    Type.Number({ description: "Number of results (default 10, max 100)" }),
  ),
});

const GetNpmPackageInfoParams = Type.Object({
  package: Type.String({ description: "npm package name" }),
});

const GetNpmPackageVersionsParams = Type.Object({
  package: Type.String({ description: "npm package name" }),
});

type SearchNpmPackagesParamsType = Static<typeof SearchNpmPackagesParams>;
type GetNpmPackageInfoParamsType = Static<typeof GetNpmPackageInfoParams>;
type GetNpmPackageVersionsParamsType = Static<
  typeof GetNpmPackageVersionsParams
>;

// NPM API response types
interface NpmSearchObject {
  package: {
    name: string;
    version: string;
    description?: string;
    keywords?: string[];
    author?: { name?: string };
  };
}

interface NpmSearchResponse {
  objects: NpmSearchObject[];
}

interface NpmMaintainer {
  name?: string;
}

interface NpmPackageVersion {
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface NpmPackageResponse {
  name?: string;
  description?: string;
  author?: { name?: string } | string;
  maintainers?: NpmMaintainer[];
  homepage?: string;
  repository?: { url?: string } | string;
  keywords?: string[];
  "dist-tags"?: Record<string, string>;
  versions?: Record<string, NpmPackageVersion>;
}

/**
 * Fetch npm package data with standardized error handling
 */
async function fetchNpmPackage(
  pkg: string,
  errorContext: string,
): Promise<
  | { ok: true; data: NpmPackageResponse }
  | { ok: false; result: AgentToolResult<Record<string, unknown>> }
> {
  try {
    const response = await throttledFetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          ok: false,
          result: {
            content: [{ type: "text", text: `Package "${pkg}" not found.` }],
            details: { package: pkg, status: 404 },
          },
        };
      }
      return {
        ok: false,
        result: {
          content: [
            {
              type: "text",
              text: `Failed to ${errorContext}: ${response.statusText}`,
            },
          ],
          details: {
            package: pkg,
            status: response.status,
            statusText: response.statusText,
          },
        },
      };
    }

    const data = (await response.json()) as NpmPackageResponse;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      result: {
        content: [
          {
            type: "text",
            text: `Error ${errorContext}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        details: { package: pkg },
      },
    };
  }
}

function extractStringOrProperty(
  value: Record<string, string> | string | undefined,
  property: string,
): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) return value[property] ?? "";
  return "";
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "search-npm-packages",
    label: "Search NPM Packages",
    description: `Search for packages available on the npm registry.

Use this to:
- Find JavaScript/TypeScript packages
- Discover libraries and frameworks
- Check package descriptions and keywords
- Explore npm ecosystem

Returns matching packages with metadata.`,
    parameters: SearchNpmPackagesParams as any,

    async execute(_toolCallId: string, params: SearchNpmPackagesParamsType) {
      const { query, size = 10 } = params;
      return await searchNpmPackages(query, size);
    },
  });

  pi.registerTool({
    name: "npm-package-info",
    label: "NPM Package Info",
    description: `Get comprehensive information about an npm package.

Use this to:
- Check package details and versions
- See dependencies and maintainers
- View licensing and repository information
- Evaluate package suitability

Returns detailed package metadata.`,
    parameters: GetNpmPackageInfoParams as any,

    async execute(_toolCallId: string, params: GetNpmPackageInfoParamsType) {
      const { package: pkg } = params;
      return await getNpmPackageInfo(pkg);
    },
  });

  pi.registerTool({
    name: "npm-package-versions",
    label: "NPM Package Versions",
    description: `List all available versions of an npm package.

Use this to:
- See version history and availability
- Check for latest versions
- Find specific version tags
- Plan version upgrades

Returns all published package versions.`,
    parameters: GetNpmPackageVersionsParams as any,

    async execute(
      _toolCallId: string,
      params: GetNpmPackageVersionsParamsType,
    ) {
      const { package: pkg } = params;
      return await getNpmPackageVersions(pkg);
    },
  });
}

async function searchNpmPackages(
  query: string,
  size: number,
): Promise<AgentToolResult<Record<string, unknown>>> {
  try {
    const response = await throttledFetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
        query,
      )}&size=${Math.min(size, 100)}`,
    );

    if (!response.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to search packages: ${response.statusText}`,
          },
        ],
        details: {
          query,
          status: response.status,
          statusText: response.statusText,
        },
      };
    }

    const data = (await response.json()) as NpmSearchResponse;
    const packages = (data.objects ?? []).map((obj: NpmSearchObject) => ({
      name: obj.package.name,
      version: obj.package.version,
      description: obj.package.description ?? "",
      keywords: Array.isArray(obj.package.keywords) ? obj.package.keywords : [],
      author: obj.package.author?.name ?? "Unknown",
    }));

    if (packages.length === 0) {
      return textResult("No packages found.", { query, count: 0, packages });
    }

    const cols: Column[] = [
      { key: "#", align: "right", minWidth: 3 },
      { key: "version", minWidth: 7 },
      {
        key: "package",
        format: (_v, row) => {
          const r = row as {
            package: string;
            description: string;
            keywords: string;
          };
          const lines = [r.package];
          if (r.description) lines.push(r.description);
          if (r.keywords) lines.push(r.keywords);
          return lines.join("\n");
        },
      },
    ];

    const rows = packages.map((pkg, i) => ({
      "#": String(i + 1),
      version: pkg.version,
      package: pkg.name,
      description: pkg.description,
      keywords: pkg.keywords.join(", "),
    }));

    const text = [
      dotJoin(countLabel(packages.length, "result")),
      "",
      table(cols, rows),
    ].join("\n");

    return textResult(text, { query, count: packages.length, packages });
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error searching packages: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      details: { query },
    };
  }
}

async function getNpmPackageInfo(
  pkg: string,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const fetchResult = await fetchNpmPackage(pkg, "get package info");
  if (!fetchResult.ok) return fetchResult.result;

  const data = fetchResult.data;
  const latestVersion = data?.["dist-tags"]?.latest ?? "";
  const latestInfo = data?.versions?.[latestVersion];

  const info = {
    name: data?.name ?? pkg,
    description: data?.description ?? "",
    author: extractStringOrProperty(data?.author, "name") || "Unknown",
    maintainers: Array.isArray(data?.maintainers)
      ? data.maintainers
          .map((m: NpmMaintainer) => m?.name)
          .filter(Boolean)
          .join(", ")
      : "Unknown",
    homepage: data?.homepage ?? "",
    repository: extractStringOrProperty(data?.repository, "url"),
    license: latestInfo?.license ?? "Unknown",
    latestVersion,
    keywords: Array.isArray(data?.keywords) ? data.keywords.join(", ") : "None",
    dependencies: latestInfo?.dependencies
      ? Object.keys(latestInfo.dependencies).length
      : 0,
    devDependencies: latestInfo?.devDependencies
      ? Object.keys(latestInfo.devDependencies).length
      : 0,
  };

  const fields = [
    { label: "name", value: info.name },
    { label: "version", value: info.latestVersion },
    { label: "license", value: info.license },
    { label: "author", value: info.author },
    { label: "description", value: info.description },
    { label: "homepage", value: info.homepage ? info.homepage : "" },
    {
      label: "repository",
      value: info.repository ? info.repository : "",
    },
    { label: "keywords", value: info.keywords ? info.keywords : "" },
    {
      label: "dependencies",
      value: `${info.dependencies} deps · ${info.devDependencies} devDeps`,
    },
  ].filter((f) => f.value);

  const sections = [detail(fields)];

  return textResult(sections.join("\n"), { package: pkg, info });
}

async function getNpmPackageVersions(
  pkg: string,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const fetchResult = await fetchNpmPackage(pkg, "get package versions");
  if (!fetchResult.ok) return fetchResult.result;

  const data = fetchResult.data;
  const versions = Object.keys(data?.versions ?? {});
  const distTags = data?.["dist-tags"] ?? {};

  const fields = [
    ...Object.entries(distTags).map(([tag, version]) => ({
      label: tag,
      value: version,
    })),
    { label: "versions", value: versions.join(", ") },
  ];

  const sections = [
    dotJoin(countLabel(versions.length, "version")),
    "",
    detail(fields),
  ];

  return textResult(sections.join("\n"), {
    package: pkg,
    count: versions.length,
    distTags,
    versions,
  });
}
