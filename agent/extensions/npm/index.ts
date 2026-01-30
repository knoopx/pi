import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

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

function textResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, details };
}

function extractStringOrProperty<
  T extends { [K in P]?: string },
  P extends string,
>(value: T | string | undefined, property: P): string {
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
    parameters: SearchNpmPackagesParams,

    async execute(
      _toolCallId: string,
      params: SearchNpmPackagesParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
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

    async execute(
      _toolCallId: string,
      params: GetNpmPackageInfoParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
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
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
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
    const response = await fetch(
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
      name: String(obj?.package?.name ?? ""),
      version: String(obj?.package?.version ?? ""),
      description: String(obj?.package?.description ?? ""),
      keywords: Array.isArray(obj?.package?.keywords)
        ? obj.package.keywords
        : [],
      author: String(obj?.package?.author?.name ?? "Unknown"),
    }));

    const result = packages
      .map(
        (pkg) =>
          `${pkg.name} ${pkg.version}: ${pkg.description} [${pkg.author}] ${pkg.keywords.join(",")}`,
      )
      .join("\n");

    return textResult(result || "No packages found.", {
      query,
      count: packages.length,
      packages,
    });
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
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          content: [{ type: "text", text: `Package "${pkg}" not found.` }],
          details: {
            package: pkg,
            status: 404,
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Failed to get package info: ${response.statusText}`,
          },
        ],
        details: {
          package: pkg,
          status: response.status,
          statusText: response.statusText,
        },
      };
    }

    const data = (await response.json()) as NpmPackageResponse;
    const latestVersion = String(data?.["dist-tags"]?.latest ?? "");
    const latestInfo = data?.versions?.[latestVersion];

    const info = {
      name: String(data?.name ?? pkg),
      description: String(data?.description ?? ""),
      author: extractStringOrProperty(data?.author, "name") || "Unknown",
      maintainers: Array.isArray(data?.maintainers)
        ? data.maintainers
            .map((m: NpmMaintainer) => m?.name)
            .filter(Boolean)
            .join(", ")
        : "Unknown",
      homepage: String(data?.homepage ?? ""),
      repository: extractStringOrProperty(data?.repository, "url"),
      license: String(latestInfo?.license ?? "Unknown"),
      latestVersion,
      keywords: Array.isArray(data?.keywords)
        ? data.keywords.join(", ")
        : "None",
      dependencies: latestInfo?.dependencies
        ? Object.keys(latestInfo.dependencies).length
        : 0,
      devDependencies: latestInfo?.devDependencies
        ? Object.keys(latestInfo.devDependencies).length
        : 0,
    };

    const result = `${info.name} ${info.latestVersion}: ${info.description} [${info.author}] ${info.license} ${info.homepage} ${info.repository} ${info.keywords} ${info.dependencies} ${info.devDependencies}`;

    return textResult(result, { package: pkg, info });
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting package info: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      details: { package: pkg },
    };
  }
}

async function getNpmPackageVersions(
  pkg: string,
): Promise<AgentToolResult<Record<string, unknown>>> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          content: [{ type: "text", text: `Package "${pkg}" not found.` }],
          details: {
            package: pkg,
            status: 404,
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Failed to get package versions: ${response.statusText}`,
          },
        ],
        details: {
          package: pkg,
          status: response.status,
          statusText: response.statusText,
        },
      };
    }

    const data = (await response.json()) as NpmPackageResponse;
    const versions = Object.keys(data?.versions ?? {});
    const distTags = (data?.["dist-tags"] ?? {}) as Record<string, string>;

    const result = `${data?.name ?? pkg} ${versions.length} versions ${Object.entries(
      distTags,
    )
      .map(([t, v]) => `${t}:${v}`)
      .join(",")} ${versions.join(",")}`;

    return textResult(result, {
      package: pkg,
      count: versions.length,
      distTags,
      versions,
    });
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting package versions: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      details: { package: pkg },
    };
  }
}
