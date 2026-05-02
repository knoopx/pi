import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { dotJoin, countLabel } from "../rendering/header";
import { table } from "../rendering/table/renderer";
import type { Column } from "../rendering/types";
export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
  keywords?: string[];
  author?: string;
}
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
        const r = row as {
          package: string;
          description: string;
          keywords: string;
          author: string;
        };
        const lines = [r.package];
        if (r.description) lines.push(r.description);
        if (r.keywords) lines.push(r.keywords);
        if (r.author) lines.push(r.author);
        return lines.join("\n");
      },
    },
  ];
  const rows = packages.map((p, i) => ({
    "#": String(i + 1),
    version: p.version,
    package: p.name,
    description: p.description,
    keywords: p.keywords?.join(", ") ?? "",
    author: p.author ?? "",
  }));

  return [dotJoin(countLabel(totalCount, unit)), "", table(cols, rows)].join(
    "\n",
  );
}
export function createPackageErrorResult(
  message: string,
  packageName?: string,
): AgentToolResult<Record<string, unknown>> {
  const details: Record<string, unknown> = {};
  if (packageName) details.package = packageName;
  return {
    content: [{ type: "text", text: message }],
    details,
  };
}
