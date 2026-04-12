import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import { textResult } from "../../shared/tool-utils";
import { throttledFetch } from "../../shared/throttle";
import { detail, dotJoin, countLabel } from "../../shared/renderers";
import { formatPackageSearchResults } from "../../shared/package-registry";

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
      if (response.status === 404)
        return {
          ok: false,
          result: {
            content: [{ type: "text", text: `Package "${pkg}" not found.` }],
            details: { package: pkg, status: 404 },
          },
        };
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

export default function (pi: ExtensionAPI): void {
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
    parameters: SearchNpmPackagesParams,

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
    parameters: GetNpmPackageInfoParams,

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
    parameters: GetNpmPackageVersionsParams,

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

    if (!response.ok)
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

    const data = (await response.json()) as NpmSearchResponse;
    const packages = (data.objects ?? []).map((obj: NpmSearchObject) => ({
      name: obj.package.name,
      version: obj.package.version,
      description: obj.package.description ?? "",
      keywords: obj.package.keywords ?? [],
      author: obj.package.author?.name ?? "",
    }));

    if (packages.length === 0)
      return textResult("No packages found.", { query, count: 0, packages });

    const text = formatPackageSearchResults(
      packages,
      packages.length,
      "result",
    );
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

function extractNpmAuthor(
  author: { name?: string } | string | undefined,
): string {
  return extractStringOrProperty(author, "name") || "Unknown";
}

function extractNpmMaintainers(
  maintainers: NpmMaintainer[] | undefined,
): string {
  if (!Array.isArray(maintainers)) return "Unknown";
  return (
    maintainers
      .map((m) => m?.name)
      .filter(Boolean)
      .join(", ") || "Unknown"
  );
}

function extractNpmKeywords(keywords: string[] | undefined): string {
  return Array.isArray(keywords) ? keywords.join(", ") : "None";
}

function countDependencies(deps: Record<string, string> | undefined): number {
  return deps ? Object.keys(deps).length : 0;
}

function extractNpmPackageInfo(
  data: NpmPackageResponse,
  pkg: string,
): Record<string, unknown> {
  const latestVersion = data?.["dist-tags"]?.latest ?? "";
  const latestInfo = data?.versions?.[latestVersion];

  return {
    name: data?.name ?? pkg,
    description: data?.description ?? "",
    author: extractNpmAuthor(data?.author),
    maintainers: extractNpmMaintainers(data?.maintainers),
    homepage: data?.homepage ?? "",
    repository: extractStringOrProperty(data?.repository, "url"),
    license: latestInfo?.license ?? "Unknown",
    latestVersion,
    keywords: extractNpmKeywords(data?.keywords),
    dependencies: countDependencies(latestInfo?.dependencies),
    devDependencies: countDependencies(latestInfo?.devDependencies),
  };
}

function buildNpmPackageFields(
  info: Record<string, unknown>,
): { label: string; value: string }[] {
  return [
    { label: "name", value: String(info.name) },
    { label: "version", value: String(info.latestVersion) },
    { label: "license", value: String(info.license) },
    { label: "author", value: String(info.author) },
    { label: "description", value: String(info.description) },
    { label: "homepage", value: String(info.homepage) },
    { label: "repository", value: String(info.repository) },
    { label: "keywords", value: String(info.keywords) },
    {
      label: "dependencies",
      value: `${info.dependencies} deps · ${info.devDependencies} devDeps`,
    },
  ].filter((f) => f.value);
}

async function getNpmPackageInfo(
  pkg: string,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const fetchResult = await fetchNpmPackage(pkg, "get package info");
  if (!fetchResult.ok) return fetchResult.result;

  const info = extractNpmPackageInfo(fetchResult.data, pkg);
  const fields = buildNpmPackageFields(info);
  const sections = [detail(fields)];

  return textResult(sections.join("\n"), { package: pkg, info });
}

async function getNpmPackageVersions(
  pkg: string,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const fetchResult = await fetchNpmPackage(pkg, "get package versions");
  if (!fetchResult.ok) return fetchResult.result;

  const { data } = fetchResult;
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
