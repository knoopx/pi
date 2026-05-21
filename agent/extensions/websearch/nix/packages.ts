import { dotJoin, countLabel } from "../../../shared/rendering/labels";
import { table } from "../../../shared/rendering/table/renderer";
import type { Column } from "../../../shared/rendering/types";
function str(value: string | undefined): string {
  return value || "";
}
import {
  cleanText,
  removeEmptyProperties,
  buildMultiMatchQuery,
  buildDisMaxQuery,
  NIXPKGS_GITHUB_BASE,
  PACKAGE_SEARCH_FIELDS,
  searchNix,
  type NixPackage,
} from "./query";
const PACKAGE_SOURCE_FIELDS = [
  "package_attr_name",
  "package_attr_set",
  "package_pname",
  "package_pversion",
  "package_system",
  "package_position",
  "package_description",
  "package_longDescription",
  "package_homepage",
  "package_maintainers",
  "package_license_set",
];
function buildPackageAggregations(): Record<string, unknown> {
  return {
    all: {
      global: {},
      aggregations: {
        package_attr_set: { terms: { field: "package_attr_set", size: 20 } },
        package_license_set: {
          terms: { field: "package_license_set", size: 20 },
        },
        package_maintainers_set: {
          terms: { field: "package_maintainers_set", size: 20 },
        },
        package_teams_set: {
          terms: { field: "package_teams_set", size: 20 },
        },
        package_platforms: {
          terms: { field: "package_platforms", size: 20 },
        },
      },
    },
  };
}
function buildPackageQuery(query: string): Record<string, unknown> {
  return {
    _source: PACKAGE_SOURCE_FIELDS,
    query: buildDisMaxQuery([
      {
        bool: {
          should: [buildMultiMatchQuery(query, PACKAGE_SEARCH_FIELDS)],
          minimum_should_match: 1,
        },
      },
    ]),
    size: 100,
    aggregations: buildPackageAggregations(),
  };
}
export async function searchNixPackages(query: string): Promise<NixPackage[]> {
  return await searchNix<NixPackage>(buildPackageQuery, query);
}
function buildPackageSourceUrl(
  position: NixPackage["package_position"],
): string | null {
  if (!position) return null;
  const lastColon = position.lastIndexOf(":");
  const filePath = (
    lastColon >= 0 ? position.slice(0, lastColon) : position
  ).replace(/^\/+/, "");
  const line = lastColon >= 0 ? position.slice(lastColon + 1) : undefined;
  const anchor = line ? `#L${line}` : "";
  return `${NIXPKGS_GITHUB_BASE}/${filePath}${anchor}`;
}
function formatHomepage(homepage: unknown): string {
  if (Array.isArray(homepage)) return homepage.join(", ");
  return String(homepage || "");
}

function formatMaintainers(maintainers: unknown[]): string {
  return maintainers
    .map((m) => {
      const obj = m as Record<string, unknown>;
      return (obj.name ?? obj.github ?? "") as string;
    })
    .join(", ");
}

export function mapPackage(item: NixPackage): Record<string, string> {
  return removeEmptyProperties({
    attr_name: item.package_attr_name,
    pname: item.package_pname,
    version: item.package_pversion,
    description: cleanText(item.package_description),
    longDescription: cleanText(item.package_longDescription),
    homepage: formatHomepage(item.package_homepage),
    maintainers: formatMaintainers(item.package_maintainers ?? []),
    license: (item.package_license_set ?? []).join(", "),
    sourceUrl: buildPackageSourceUrl(item.package_position) ?? "",
  });
}

function buildPackageMeta(row: Record<string, string>): string | null {
  const meta: string[] = [];
  if (row.attr_name) meta.push(`attr: ${row.attr_name}`);
  if (row.license) meta.push(row.license);
  return meta.length > 0 ? meta.join(" · ") : null;
}

function appendPackageFields(lines: string[], r: Record<string, string>): void {
  for (const field of ["description", "maintainers", "homepage", "sourceUrl"])
    if (r[field]) lines.push(r[field]);
  const meta = buildPackageMeta(r);
  if (meta) lines.push(meta);
}

export function formatPackageTable(res: Record<string, string>[]): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 3 },
    { key: "version", minWidth: 7 },
    {
      key: "package",
      format(_v, row) {
        const r = row as Record<string, string>;
        const lines = [r.package];
        appendPackageFields(lines, r);
        return lines.join("\n");
      },
    },
  ];
  const rows = res.map((pkg, i) => ({
    "#": String(i + 1),
    version: str(pkg.version),
    package: str(pkg.pname) || str(pkg.attr_name),
    description: str(pkg.description),
    attr_name: str(pkg.attr_name),
    license: str(pkg.license),
    maintainers: str(pkg.maintainers),
    homepage: str(pkg.homepage),
    sourceUrl: str(pkg.sourceUrl),
  }));

  return [
    dotJoin(countLabel(res.length, "result")),
    "",
    table(cols, rows),
  ].join("\n");
}
