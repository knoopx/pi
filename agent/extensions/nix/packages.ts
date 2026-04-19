import { throttledFetch } from "../../shared/throttle";
import { dotJoin, countLabel, table } from "../../shared/renderers";
import type { Column } from "../../shared/renderers";
import {
  cleanText,
  removeEmptyProperties,
  buildMultiMatchQuery,
  buildDisMaxQuery,
  PACKAGE_SOURCE_FIELDS,
  PACKAGE_MUST_FIELDS,
  searchNix,
  type NixPackage,
} from "./query";

const PACKAGE_FILTERS = [{ field: "package_attr_set", value: "nixpkgs" }];

function buildPackageFilterItem(): Record<string, unknown> {
  const filters = [...PACKAGE_FILTERS];
  return { bool: { filter: filters } };
}

function buildEmptyBoolMustArray(): Record<string, unknown>[] {
  return [];
}

function buildPackageQueryClause(query: string): Record<string, unknown> {
  const must = buildEmptyBoolMustArray();
  const should = [buildMultiMatchQuery(query, PACKAGE_SOURCE_FIELDS)];
  if (must.length > 0) {
    return { bool: { must, should, minimum_should_match: 1 } };
  }
  return { bool: { should, minimum_should_match: 1 } };
}

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
    _source: PACKAGE_MUST_FIELDS,
    query: buildDisMaxQuery([buildPackageQueryClause(query)]),
    size: 100,
    aggregations: buildPackageAggregations(),
  };
}

export async function searchNixPackages(query: string): Promise<NixPackage[]> {
  console.error("[searchNixPackages] Searching for:", query);
  const result = await searchNix(buildPackageQuery, throttledFetch, query);
  console.error("[searchNixPackages] Got", result.length, "results");
  return result;
}

export function mapPackage(item: NixPackage): Record<string, string> {
  return removeEmptyProperties({
    attr_name: item.package_attr_name,
    pname: item.package_pname,
    version: item.package_pversion,
    description: cleanText(item.package_description),
    longDescription: cleanText(item.package_longDescription),
    homepage: Array.isArray(item.package_homepage)
      ? item.package_homepage.join(", ")
      : String(item.package_homepage || ""),
    maintainers: (item.package_maintainers ?? [])
      .map((m) => m.name || m.github)
      .join(", "),
    license: (item.package_license_set ?? []).join(", "),
  });
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
        if (r.description) lines.push(r.description);
        const meta: string[] = [];
        if (r.attr_name) meta.push(`attr: ${r.attr_name}`);
        if (r.license) meta.push(r.license);
        if (meta.length > 0) lines.push(meta.join(" · "));
        if (r.maintainers) lines.push(r.maintainers);
        if (r.homepage) lines.push(r.homepage);
        return lines.join("\n");
      },
    },
  ];

  const rows = res.map((pkg, i) => ({
    "#": String(i + 1),
    version: pkg.version || "",
    package: pkg.pname || pkg.attr_name || "",
    description: pkg.description || "",
    attr_name: pkg.attr_name || "",
    license: pkg.license || "",
    maintainers: pkg.maintainers || "",
    homepage: pkg.homepage || "",
  }));

  return [
    dotJoin(countLabel(res.length, "result")),
    "",
    table(cols, rows),
  ].join("\n");
}
