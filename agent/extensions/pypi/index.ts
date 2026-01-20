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
import type { TextContent } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

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

function textResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, details };
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
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
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
          const directResponse = await fetch(
            `https://pypi.org/pypi/${encodeURIComponent(query)}/json`,
            { signal: _signal },
          );

          if (directResponse.ok) {
            const data =
              (await directResponse.json()) as PyPIPackageResponse;
            const info = data.info;
            return textResult(
              `Found 1 package matching "${query}":\n\n**${info.name}** (${info.version})\n${info.summary || "No description available"}\n`,
              { query, total: 1, returned: 1 },
            );
          }

          return {
            content: [
              {
                type: "text",
                text: `No packages found matching "${query}".`,
              },
            ],
            details: { query },
          };
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
          const fallbackResponse = await fetch(
            `https://pypi.org/pypi/${encodeURIComponent(query)}/json`,
            { signal: _signal },
          );

          if (fallbackResponse.ok) {
            const data =
              (await fallbackResponse.json()) as PyPIPackageResponse;
            const info = data.info;
            return textResult(
              `Found 1 package matching "${query}":\n\n**${info.name}** (${info.version})\n${info.summary || "No description available"}\n`,
              { query, total: 1, returned: 1 },
            );
          }

          return {
            content: [
              {
                type: "text",
                text: `No packages found matching "${query}".`,
              },
            ],
            details: { query },
          };
        }

        let output = `Found ${packages.length} package(s) matching "${query}":\n\n`;
        for (const pkg of packages) {
          output += `**${pkg.name}** (${pkg.version})\n`;
          output += `${pkg.description}\n\n`;
        }

        return textResult(output, {
          query,
          total: packages.length,
          returned: packages.length,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to search packages: ${String(error)}`,
            },
          ],
          details: { query },
        };
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
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
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
            return {
              content: [
                {
                  type: "text",
                  text: `Package "${packageName}" not found on PyPI.`,
                },
              ],
              details: { package: packageName },
            };
          }
          return {
            content: [
              {
                type: "text",
                text: `Error fetching package info: HTTP ${response.status}`,
              },
            ],
            details: { package: packageName },
          };
        }

        const data = (await response.json()) as PyPIPackageResponse;
        const info = data.info;

        let output = `Package: ${info.name}\n\n`;
        output += `**Version:** ${info.version}\n`;
        output += `**Summary:** ${info.summary || "No summary"}\n`;
        output += `**Home-page:** ${info.home_page || info.project_url || "Not specified"}\n`;
        output += `**Author:** ${info.author || info.maintainer || "Unknown"}\n`;
        output += `**Author Email:** ${info.author_email || info.maintainer_email || "Not specified"}\n`;
        output += `**License:** ${info.license || "Unknown"}\n`;
        output += `**Python Requires:** ${info.requires_python || "Not specified"}\n`;

        if (info.requires_dist && info.requires_dist.length > 0) {
          // Show first 20 dependencies to avoid overwhelming output
          const deps = info.requires_dist.slice(0, 20);
          output += `**Dependencies:** ${deps.join(", ")}`;
          if (info.requires_dist.length > 20) {
            output += ` ... and ${info.requires_dist.length - 20} more`;
          }
          output += "\n";
        }

        if (info.project_urls) {
          output += `\n**Project URLs:**\n`;
          for (const [name, url] of Object.entries(info.project_urls)) {
            output += `  - ${name}: ${url}\n`;
          }
        }

        if (info.keywords) {
          output += `\n**Keywords:** ${info.keywords}\n`;
        }

        return textResult(output, { package: packageName, info });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to show package info: ${String(error)}`,
            },
          ],
          details: { package: packageName },
        };
      }
    },
  });
}
