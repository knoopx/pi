/**
 * PyPI Extension
 *
 * Provides tools to query Python packages from PyPI.
 * Tools available: pypi-search, pypi-package-info
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import { textResult } from "../../shared/tool-utils";
import { throttledFetch } from "../../shared/throttle";
import { detail } from "../../shared/renderers";
import {
  formatPackageSearchResults,
  createPackageErrorResult,
} from "../../shared/package-registry";
import type { PackageSearchResult } from "../../shared/package-registry";

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

interface PyPISearchResult extends PackageSearchResult {
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

    if (name.length > 0 && version.length > 0)
      packages.push({
        name,
        version,
        description: description || "No description available",
      });

    offset = anchorEnd + 4;
  }

  return packages;
}

function createPypiErrorResult(
  message: string,
  packageName: string,
): AgentToolResult<Record<string, unknown>> {
  return createPackageErrorResult(message, packageName);
}

async function tryDirectPackageLookup(
  query: string,
): Promise<AgentToolResult<Record<string, unknown>> | null> {
  try {
    const response = await throttledFetch(
      `https://pypi.org/pypi/${encodeURIComponent(query)}/json`,
    );

    if (!response.ok) return null;

    const text = await response.text();
    const data = JSON.parse(text) as PyPIPackageResponse;
    const { info } = data;
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

async function executeSearchPackages(
  _toolCallId: string,
  params: SearchPyPIPackagesParamsType,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const { query, limit = 10 } = params;

  try {
    const searchUrl = `https://pypi.org/search/?q=${encodeURIComponent(query)}&o=`;
    const response = await throttledFetch(searchUrl, {
      signal: undefined,
      headers: { Accept: "application/vnd.pypi.simple.v1+json" },
    });

    if (!response.ok) {
      const directResult = await tryDirectPackageLookup(query);
      return directResult ?? createPypiErrorResult(`No packages found.`, query);
    }

    const html = await response.text();
    const packages = parseSearchResultsFromHtml(html, limit);

    if (packages.length === 0) {
      const directResult = await tryDirectPackageLookup(query);
      return directResult ?? createPypiErrorResult(`No packages found.`, query);
    }

    const output = formatPackageSearchResults(
      packages,
      packages.length,
      "result",
    );
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
}

function buildPackageInfoFields(
  info: PyPIPackageInfo,
): Array<{ label: string; value: string }> {
  const author = info.author || info.maintainer || "-";
  const license = info.license || "-";
  const homePage = info.home_page || info.project_url || "-";
  const summary = info.summary || "-";

  return [
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
}

async function executePackageInfo(
  _toolCallId: string,
  params: PyPIPackageInfoParamsType,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const { package: packageName } = params;

  try {
    const response = await throttledFetch(
      `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`,
      { signal: undefined },
    );

    if (!response.ok) {
      if (response.status === 404)
        return createPypiErrorResult(
          `Package "${packageName}" not found on PyPI.`,
          packageName,
        );
      return createPypiErrorResult(
        `Error fetching package info: HTTP ${response.status}`,
        packageName,
      );
    }

    const data = (await response.json()) as PyPIPackageResponse;
    const { info } = data;
    const fields = buildPackageInfoFields(info);
    const output = detail(fields);

    return textResult(output, { package: packageName, info });
  } catch (error) {
    return createPypiErrorResult(
      `Failed to show package info: ${String(error)}`,
      packageName,
    );
  }
}

function createSearchTool() {
  return {
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
    execute: executeSearchPackages,
  };
}

function createPackageInfoTool() {
  return {
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
    execute: executePackageInfo,
  };
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createSearchTool());
  pi.registerTool(createPackageInfoTool());
}
