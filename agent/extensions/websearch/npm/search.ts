import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { textResult } from "../../../shared/result/tool";
import { throttledFetch } from "../lib/throttle";
import { formatPackageSearchResults } from "../lib/package-registry";

export const SearchNpmPackagesParams = Type.Object({
  query: Type.String({ description: "Search query for npm packages" }),
  size: Type.Optional(
    Type.Number({ description: "Number of results (default 10, max 100)" }),
  ),
});
export type SearchNpmPackagesParamsType = Static<
  typeof SearchNpmPackagesParams
>;

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
interface PackageInfo {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  author: string;
}

function extractAuthor(pkg: { author?: { name?: string } }): string {
  return pkg.author?.name ?? "";
}

function extractPackageInfo(obj: NpmSearchObject) {
  const pkg = obj.package;
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description ?? "",
    keywords: pkg.keywords ?? [],
    author: extractAuthor(pkg),
  };
}

function handleSearchError(
  query: string,
  response: Response,
): AgentToolResult<Record<string, unknown>> {
  return createNpmSearchError(
    query,
    `Failed to search packages: ${response.statusText}`,
    response.status,
    response.statusText,
  );
}

function parseSearchObjects(data: NpmSearchResponse): PackageInfo[] {
  return (data.objects ?? []).map(extractPackageInfo);
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

    if (!response.ok) return handleSearchError(query, response);
    const data = (await response.json()) as NpmSearchResponse;
    const packages = parseSearchObjects(data);

    if (!packages.length)
      return textResult("No packages found.", { query, count: 0, packages });
    const text = formatPackageSearchResults(
      packages,
      packages.length,
      "result",
    );
    return textResult(text, { query, count: packages.length, packages });
  } catch (error) {
    return createNpmSearchError(
      query,
      `Error searching packages: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function createNpmSearchError(
  query: string,
  text: string,
  status?: number,
  statusText?: string,
): AgentToolResult<Record<string, unknown>> {
  const details: Record<string, unknown> = { query };
  if (status !== undefined) details.status = status;
  if (statusText !== undefined) details.statusText = statusText;
  return { content: [{ type: "text" as const, text }], details };
}

export async function executeNpmSearch(
  _toolCallId: string,
  params: SearchNpmPackagesParamsType,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const { query, size = 10 } = params;
  return await searchNpmPackages(query, size);
}
