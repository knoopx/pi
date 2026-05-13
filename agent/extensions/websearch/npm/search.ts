import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { Static } from "typebox";
import { textResult } from "../../../shared/result/tool";
import { throttledFetch } from "../../../shared/network/throttle";
import { formatPackageSearchResults } from "../../../shared/format/package-registry";

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
      const text = `Failed to search packages: ${response.statusText}`;
      return {
        content: [{ type: "text", text }],
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
    const text = `Error searching packages: ${error instanceof Error ? error.message : String(error)}`;
    return {
      content: [{ type: "text", text }],
      details: { query },
    };
  }
}

export async function executeNpmSearch(
  _toolCallId: string,
  params: SearchNpmPackagesParamsType,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const { query, size = 10 } = params;
  return await searchNpmPackages(query, size);
}
