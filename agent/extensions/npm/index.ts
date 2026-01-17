import type { ExtensionAPI, OnUpdate, ToolContext } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

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

function textResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, details };
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

    async execute(_toolCallId: string, params: any, _onUpdate: OnUpdate, _ctx: ToolContext, _signal: AbortSignal) {
      const { query, size = 10 } = params as { query: string; size?: number };
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

    async execute(_toolCallId: string, params: any, _onUpdate: OnUpdate, _ctx: ToolContext, _signal: AbortSignal) {
      const { package: pkg } = params as { package: string };
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

    async execute(_toolCallId: string, params: any, _onUpdate: OnUpdate, _ctx: ToolContext, _signal: AbortSignal) {
      const { package: pkg } = params as { package: string };
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
      return textResult(`Failed to search packages: ${response.statusText}`, {
        query,
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = (await response.json()) as any;
    const packages = (data.objects ?? []).map((obj: any) => ({
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
        (pkg: {
          name: string;
          version: string;
          description: string;
          keywords: string[];
          author: string;
        }) =>
          `**${pkg.name}** (${pkg.version})\n${pkg.description}\nAuthor: ${pkg.author}\nKeywords: ${pkg.keywords.join(
            ", ",
          )}\n---`,
      )
      .join("\n");

    return textResult(result || "No packages found.", {
      query,
      count: packages.length,
    });
  } catch (error) {
    return textResult(
      `Error searching packages: ${error instanceof Error ? error.message : String(error)}`,
      { query },
    );
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
        return textResult(`Package "${pkg}" not found.`, {
          package: pkg,
          status: 404,
        });
      }

      return textResult(`Failed to get package info: ${response.statusText}`, {
        package: pkg,
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = (await response.json()) as any;
    const latestVersion = String(data?.["dist-tags"]?.latest ?? "");
    const latestInfo = data?.versions?.[latestVersion];

    const info = {
      name: String(data?.name ?? pkg),
      description: String(data?.description ?? ""),
      author: String(data?.author?.name ?? data?.author ?? "Unknown"),
      maintainers: Array.isArray(data?.maintainers)
        ? data.maintainers
            .map((m: any) => m?.name)
            .filter(Boolean)
            .join(", ")
        : "Unknown",
      homepage: String(data?.homepage ?? ""),
      repository: String(data?.repository?.url ?? data?.repository ?? ""),
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

    const result = `**${info.name}**\n\n${info.description}\n\n- **Author:** ${info.author}\n- **Maintainers:** ${info.maintainers}\n- **Latest Version:** ${info.latestVersion}\n- **License:** ${info.license}\n- **Homepage:** ${info.homepage || "N/A"}\n- **Repository:** ${info.repository || "N/A"}\n- **Keywords:** ${info.keywords}\n- **Dependencies:** ${info.dependencies}\n- **Dev Dependencies:** ${info.devDependencies}`;

    return textResult(result, { package: pkg });
  } catch (error) {
    return textResult(
      `Error getting package info: ${error instanceof Error ? error.message : String(error)}`,
      { package: pkg },
    );
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
        return textResult(`Package "${pkg}" not found.`, {
          package: pkg,
          status: 404,
        });
      }

      return textResult(
        `Failed to get package versions: ${response.statusText}`,
        {
          package: pkg,
          status: response.status,
          statusText: response.statusText,
        },
      );
    }

    const data = (await response.json()) as any;
    const versions = Object.keys(data?.versions ?? {});
    const distTags = (data?.["dist-tags"] ?? {}) as Record<string, string>;

    let result = `**${data?.name ?? pkg} Versions**\n\n**Dist Tags:**\n`;
    for (const [tag, version] of Object.entries(distTags)) {
      result += `- ${tag}: ${version}\n`;
    }
    result += `\n**All Versions:**\n${versions.join("\n")}`;

    return textResult(result, { package: pkg, count: versions.length });
  } catch (error) {
    return textResult(
      `Error getting package versions: ${error instanceof Error ? error.message : String(error)}`,
      { package: pkg },
    );
  }
}
