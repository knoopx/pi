import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { Static } from "typebox";
import { textResult } from "../../shared/result/tool-result";
import { throttledFetch } from "../../shared/network/throttle";
import {
  formatPackageSearchResults,
  createPackageErrorResult,
} from "../../shared/format/package-registry";
import type { PackageSearchResult } from "../../shared/format/package-registry";

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
type SearchPyPIPackagesParamsType = Static<typeof SearchPyPIPackagesParams>;

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

async function tryDirectPackageLookup(
  query: string,
): Promise<AgentToolResult<Record<string, unknown>> | null> {
  try {
    const response = await throttledFetch(
      `https://pypi.org/pypi/${encodeURIComponent(query)}/json`,
    );

    if (!response.ok) return null;
    const text = await response.text();
    const data = JSON.parse(text) as {
      info: { name: string; version: string; summary?: string };
    };
    const { info } = data;
    const summary = info.summary || "-";

    return textResult(`${info.name} ${info.version}: ${summary}`.trim(), {
      query,
      total: 1,
      returned: 1,
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
      return (
        directResult ?? createPackageErrorResult(`No packages found.`, query)
      );
    }
    const html = await response.text();
    const packages = parseSearchResultsFromHtml(html, limit);

    if (packages.length === 0) {
      const directResult = await tryDirectPackageLookup(query);
      return (
        directResult ?? createPackageErrorResult(`No packages found.`, query)
      );
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
    return createPackageErrorResult(
      `Failed to search packages: ${String(error)}`,
      query,
    );
  }
}

export default function (pi: ExtensionAPI): void {
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
    execute: executeSearchPackages,
  });
}
