/**
 * PyPI Extension
 *
 * Provides tools to query Python packages from PyPI.
 * Tools available: pypi-search, pypi-package-info
 */

import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import { textResult } from "../../shared/tool-utils";

// Parameter schemas
const SearchPyPIPackagesParams = Type.Object({
  query: Type.String({
    description: "Search query (package name or keyword)",
  }),
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return (default: 10)",
      minimum: 1,
      maximum: 50,
    }),
  ),
});

const PyPIPackageInfoParams = Type.Object({
  package: Type.String({
    description: "Name of the package to show information for",
  }),
});

type SearchPyPIPackagesParamsType = Static<typeof SearchPyPIPackagesParams>;
type PyPIPackageInfoParamsType = Static<typeof PyPIPackageInfoParams>;

// PyPI API response types
interface PyPIPackageInfo {
  name: string;
  version: string;
  summary?: string;
  home_page?: string;
  project_url?: string;
  author?: string;
  maintainer?: string;
  author_email?: string;
  maintainer_email?: string;
  license?: string;
  requires_python?: string;
  requires_dist?: string[];
  project_urls?: Record<string, string>;
  keywords?: string;
}

interface PyPIPackageResponse {
  info: PyPIPackageInfo;
}

/**
 * Helper function to create an error result
 */
function createPypiErrorResult(
  message: string,
  packageName: string,
): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: "text", text: message }],
    details: { package: packageName, total: 0, returned: 0 },
  };
}

/**
 * Try to fetch a package directly by name from PyPI JSON API
 */
async function tryDirectPackageLookup(
  query: string,
  signal?: AbortSignal,
): Promise<AgentToolResult<Record<string, unknown>> | null> {
  try {
    const response = await fetch(
      `https://pypi.org/pypi/${encodeURIComponent(query)}/json`,
      { signal },
    );

    if (!response.ok) return null;

    const text = await response.text();
    const data = JSON.parse(text) as PyPIPackageResponse;
    const info = data.info;
    return textResult(`${info.name} ${info.version}: ${info.summary || "-"}`, {
      query,
      total: 1,
      returned: 1,
      info,
    });
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI) {
  // Tool to search for packages
  pi.registerTool({
    name: "search-pypi-packages",
    label: "Search PyPI Packages",
    description: `Search for Python packages available on PyPI.

Use this to:
- Find packages by name or functionality
- Discover libraries for specific tasks
- Check package descriptions and versions
- Explore available Python packages

Returns matching packages with metadata.`,
    parameters: SearchPyPIPackagesParams,

    async execute(
      _toolCallId: string,
      params: SearchPyPIPackagesParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      const { query, limit = 10 } = params;

      try {
        // Use PyPI Simple API search endpoint
        const searchUrl = `https://pypi.org/search/?q=${encodeURIComponent(query)}&o=`;
        const response = await fetch(searchUrl, {
          signal: _signal,
          headers: {
            Accept: "application/vnd.pypi.simple.v1+json",
          },
        });

        if (!response.ok) {
          // Fallback: try to fetch the package directly if it's an exact name
          const directResult = await tryDirectPackageLookup(query, _signal);
          return (
            directResult ?? createPypiErrorResult(`No packages found.`, query)
          );
        }

        // Parse HTML response to extract package info (PyPI doesn't have a JSON search API)
        const html = await response.text();

        // Extract package names and descriptions from search results
        const packageRegex =
          /<a class="package-snippet"[^>]*href="\/project\/([^/]+)\/"[^>]*>[\s\S]*?<span class="package-snippet__name">([^<]+)<\/span>[\s\S]*?<span class="package-snippet__version">([^<]+)<\/span>[\s\S]*?<p class="package-snippet__description">([^<]*)<\/p>/g;

        const packages: Array<{
          name: string;
          version: string;
          description: string;
        }> = [];
        let match;

        while (
          (match = packageRegex.exec(html)) !== null &&
          packages.length < limit
        ) {
          packages.push({
            name: match[2].trim(),
            version: match[3].trim(),
            description: match[4].trim() || "No description available",
          });
        }

        if (packages.length === 0) {
          // Try direct package lookup as fallback
          const directResult = await tryDirectPackageLookup(query, _signal);
          return (
            directResult ?? createPypiErrorResult(`No packages found.`, query)
          );
        }

        const output = packages
          .map((p) => `${p.name} ${p.version}: ${p.description}`)
          .join("\n");

        return textResult(output, {
          query,
          total: packages.length,
          returned: packages.length,
          packages,
        });
      } catch (error) {
        return createPypiErrorResult(
          `Failed to search packages: ${String(error)}`,
          query,
        );
      }
    },
  });

  // Tool to show package information
  pi.registerTool({
    name: "pypi-package-info",
    label: "PyPI Package Info",
    description: `Get detailed information about a Python package from PyPI.

Use this to:
- Check package version and metadata
- See package dependencies
- View package licensing
- Get package author and homepage information

Shows comprehensive package details from PyPI.`,
    parameters: PyPIPackageInfoParams,

    async execute(
      _toolCallId: string,
      params: PyPIPackageInfoParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      const { package: packageName } = params;

      try {
        // Use PyPI JSON API instead of local pip command
        const response = await fetch(
          `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`,
          { signal: _signal },
        );

        if (!response.ok) {
          if (response.status === 404) {
            return createPypiErrorResult(
              `Package "${packageName}" not found on PyPI.`,
              packageName,
            );
          }
          return createPypiErrorResult(
            `Error fetching package info: HTTP ${response.status}`,
            packageName,
          );
        }

        const data = (await response.json()) as PyPIPackageResponse;
        const info = data.info;

        const author = info.author || info.maintainer || "-";
        let result = `${info.name} ${info.version}: ${info.summary || "-"} [${author}]`;
        if (info.license) result += ` ${info.license}`;
        if (info.requires_python) result += ` ${info.requires_python}`;
        if (info.home_page || info.project_url)
          result += ` ${info.home_page || info.project_url}`;
        if (info.author_email || info.maintainer_email)
          result += ` ${info.author_email || info.maintainer_email}`;
        if (info.requires_dist && info.requires_dist.length > 0) {
          const deps = info.requires_dist.slice(0, 20).join(" ");
          result += ` ${deps}${info.requires_dist.length > 20 ? ` +${info.requires_dist.length - 20}` : ""}`;
        }
        if (info.project_urls)
          result += ` ${Object.entries(info.project_urls)
            .map(([k, v]) => `${k}:${v}`)
            .join(" ")}`;
        if (info.keywords) result += ` ${info.keywords}`;

        return textResult(result, { package: packageName, info });
      } catch (error) {
        return createPypiErrorResult(
          `Failed to show package info: ${String(error)}`,
          packageName,
        );
      }
    },
  });
}
