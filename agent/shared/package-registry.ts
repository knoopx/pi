/**
 * Shared utilities for package registry tools (npm, pypi, etc.)
 */

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { dotJoin, countLabel, table } from "./renderers";
import type { Column } from "./renderers";

/**
 * Base interface for package search results
 */
export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
}

/**
 * Format package search results into a table
 */
export function formatPackageSearchResults(
  packages: PackageSearchResult[],
  totalCount: number,
  unit: "package" | "result" = "package",
): string {
  if (packages.length === 0) {
    return `No ${unit}s found.`;
  }

  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 3 },
    { key: "version", minWidth: 7 },
    {
      key: "package",
      format: (_v, row) => {
        const r = row as { package: string; description: string };
        const lines = [r.package];
        if (r.description) lines.push(r.description);
        return lines.join("\n");
      },
    },
  ];

  const rows = packages.map((p, i) => ({
    "#": String(i + 1),
    version: p.version,
    package: p.name,
    description: p.description,
  }));

  return [dotJoin(countLabel(totalCount, unit)), "", table(cols, rows)].join(
    "\n",
  );
}

/**
 * Create a standardized error result for package operations
 */
export function createPackageErrorResult(
  message: string,
  packageName?: string,
): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: "text", text: message }],
    details: packageName ? { package: packageName } : {},
  };
}
