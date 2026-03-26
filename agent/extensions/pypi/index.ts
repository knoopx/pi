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
import { throttledFetch } from "../../shared/throttle";
import { dotJoin, countLabel, table, detail } from "../../shared/renderers";
import type { Column } from "../../shared/renderers";

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

interface PyPISearchResult {
  name: string;
  version: string;
  description: string;
}

function extractBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  if (startIndex === -1) return "";
  const contentStart = startIndex + start.length;
  const endIndex = source.indexOf(end, contentStart);
  if (endIndex === -1) return "";
  return source.slice(contentStart, endIndex).trim();
}

function parseSearchResultsFromHtml(
  html: string,
  limit: number,
): PyPISearchResult[] {
  const packages: PyPISearchResult[] = [];
  let offset = 0;

  while (packages.length < limit) {
    const anchorStart = html.indexOf('<a class="package-snippet"', offset);
    if (anchorStart === -1) break;

    const anchorEnd = html.indexOf("</a>", anchorStart);
    if (anchorEnd === -1) break;

    const block = html.slice(anchorStart, anchorEnd + 4);
    const name = extractBetween(
      block,
      '<span class="package-snippet__name">',
      "</span>",
    );
    const version = extractBetween(
      block,
      '<span class="package-snippet__version">',
      "</span>",
    );
    const description = extractBetween(
      block,
      '<p class="package-snippet__description">',
      "</p>",
    );

    if (name.length > 0 && version.length > 0) {
      packages.push({
        name,
        version,
        description: description || "No description available",
      });
    }

    offset = anchorEnd + 4;
  }

  return packages;
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
    const response = await throttledFetch(
      `https://pypi.org/pypi/${encodeURIComponent(query)}/json`,
      { signal },
    );

    if (!response.ok) return null;

    const text = await response.text();
    const data = JSON.parse(text) as PyPIPackageResponse;
    const info = data.info;
    const summary = info.summary || "-";

    return textResult(`${info.name} ${info.version}: ${summary}`.trim(), {
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
        const response = await throttledFetch(searchUrl, {
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
        const packages = parseSearchResultsFromHtml(html, limit);

        if (packages.length === 0) {
          // Try direct package lookup as fallback
          const directResult = await tryDirectPackageLookup(query, _signal);
          return (
            directResult ?? createPypiErrorResult(`No packages found.`, query)
          );
        }

        const cols: Column[] = [
          { key: "#", align: "right", minWidth: 3 },
          { key: "version", minWidth: 7 },
          {
            key: "package",
            format: (_v, row) => {
              const r = row as { package: string; description: string };
              return r.description
                ? `${r.package}\n${r.description}`
                : r.package;
            },
          },
        ];

        const rows = packages.map((p, i) => ({
          "#": String(i + 1),
          version: p.version,
          package: p.name,
          description: p.description,
        }));

        const output = [
          dotJoin(countLabel(packages.length, "result")),
          "",
          table(cols, rows),
        ].join("\n");

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
        const response = await throttledFetch(
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
        const license = info.license || "-";
        const homePage = info.home_page || info.project_url || "-";
        const summary = info.summary || "-";

        const fields = [
          { label: "name", value: info.name },
          { label: "version", value: info.version },
          { label: "license", value: license },
          { label: "author", value: author },
          { label: "description", value: summary },
          { label: "homepage", value: homePage !== "-" ? homePage : "-" },
          ...(Array.isArray(info.requires_dist) && info.requires_dist.length > 0
            ? [{ label: "dependencies", value: info.requires_dist.join(", ") }]
            : []),
        ].filter((f) => f.value && f.value !== "-");

        const output = detail(fields);

        return textResult(output, {
          package: packageName,
          info,
        });
      } catch (error) {
        return createPypiErrorResult(
          `Failed to show package info: ${String(error)}`,
          packageName,
        );
      }
    },
  });
}
