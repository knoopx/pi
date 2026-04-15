import type {
  ExtensionAPI,
  AgentToolResult,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { dotJoin, countLabel, table } from "../../shared/renderers";
import type { Column } from "../../shared/renderers";
import { throttledFetch } from "../../shared/throttle";

// Parameter schema for search queries
const SearchQueryParams = Type.Object({
  query: Type.String({
    description: "Search query (option name or description)",
  }),
});

type SearchQueryParamsType = Static<typeof SearchQueryParams>;

// Adapted from https://github.com/vicinaehq/extensions/tree/main/extensions/nix

interface NixPackage {
  type: string;
  package_attr_name: string;
  package_attr_set: string;
  package_pname: string;
  package_pversion: string;
  package_platforms: string[];
  package_outputs: string[];
  package_default_output: string;
  package_programs: string[];
  package_mainProgram: string | null;
  package_license: {
    url: string;
    fullName: string;
  }[];
  package_license_set: string[];
  package_maintainers: {
    name: string;
    github: string;
    email: string;
  }[];
  package_maintainers_set: string[];
  package_teams: {
    members: {
      name: string;
      github: string;
      email: string;
    }[];
    scope: string;
    shortName: string;
    githubTeams: string[];
  }[];
  package_teams_set: string[];
  package_description: string | null;
  package_longDescription: string | null;
  package_hydra: Record<string, unknown> | null;
  package_system: string;
  package_homepage: string[];
  package_position: string;
}

interface NixOption {
  type: string;
  option_name: string;
  option_description: string;
  option_flake: string | null;
  option_type: string;
  option_default?: string;
  option_example?: string;
  option_source?: string;
}

interface HomeManagerOption {
  title: string;
  description: string;
  type: string;
  default: string;
  example: string;
  declarations: {
    name: string;
    url: string;
  }[];
  loc: string[];
  readOnly: boolean;
}

interface HomeManagerOptionResponse {
  last_update: string;
  options: HomeManagerOption[];
}

interface NixSearchResponse<T> {
  hits: {
    hits: { _source: T }[];
  };
}

const SEARCH_URL =
  "https://search.nixos.org/backend/latest-44-nixos-unstable/_search";
const AUTH_TOKEN =
  process.env.NIX_SEARCH_TOKEN ??
  "YVdWU0FMWHBadjpYOGdQSG56TDUyd0ZFZWt1eHNmUTljU2g=";
const HOME_MANAGER_OPTIONS_URL =
  "https://home-manager-options.extranix.com/data/options-master.json";

function cleanText(text: string | null): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").trim();
}

function removeEmptyProperties<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
    )
      result[key as keyof T] = value as T[keyof T];
  }
  return result;
}

function buildSearchResult<T>(
  results: T[],
  query: string,
  contentBuilder: (res: T[]) => string,
): {
  content: { type: "text"; text: string }[];
  details: { query: string; totalFound: number };
} {
  const content = contentBuilder(results);
  return {
    content: [{ type: "text", text: content }],
    details: { query, totalFound: results.length },
  };
}

/**
 * Builds a table renderer for option-like results with common columns
 */
function buildOptionTableRenderer(
  includeDeclarations = false,
): (res: Record<string, string>[]) => string {
  return (res) => {
    const cols: Column[] = [
      { key: "#", align: "right", minWidth: 3 },
      { key: "type", minWidth: 11 },
      {
        key: "option",
        format(_v, row) {
          const r = row as Record<string, string>;
          const lines: string[] = [];
          if (r.option) lines.push(r.option);
          if (r.description) lines.push(r.description);
          if (r.default) lines.push(`default: ${r.default}`);
          if (r.example) lines.push(`example: ${r.example}`);
          if (includeDeclarations && r.declarations) lines.push(r.declarations);
          return lines.join("\n");
        },
      },
    ];

    const rows = res.map((item, i) => ({
      "#": String(i + 1),
      type: item.type || "",
      option: item.option || "",
      description: item.description || "",
      default: item.default || "",
      example: item.example || "",
      declarations: item.declarations ?? "",
    }));

    return [
      dotJoin(countLabel(res.length, "result")),
      "",
      table(cols, rows),
    ].join("\n");
  };
}

/**
 * Helper to build aggregation terms (reused at top-level and inside 'all')
 */
function buildAggregationTerms(): Record<string, unknown> {
  return {
    package_attr_set: { terms: { field: "package_attr_set", size: 20 } },
    package_license_set: { terms: { field: "package_license_set", size: 20 } },
    package_maintainers_set: {
      terms: { field: "package_maintainers_set", size: 20 },
    },
    package_teams_set: { terms: { field: "package_teams_set", size: 20 } },
    package_platforms: { terms: { field: "package_platforms", size: 20 } },
  };
}

/**
 * Helper function to build common aggregations structure
 */
function buildCommonAggregations(): Record<string, unknown> {
  return {
    global: {},
    aggregations: buildAggregationTerms(),
  };
}

/**
 * Helper to build multi_match query
 */
function buildMultiMatchQuery(
  query: string,
  fields: string[],
): Record<string, unknown> {
  return {
    multi_match: {
      type: "cross_fields",
      query,
      analyzer: "whitespace",
      auto_generate_synonyms_phrase_query: false,
      operator: "and",
      _name: `multi_match_${query}`,
      fields,
    },
  };
}

/**
 * Helper to build wildcard query
 */
function buildWildcardQuery(
  wildcardField: string,
  query: string,
): Record<string, unknown> {
  return {
    wildcard: {
      [wildcardField]: {
        value: `*${query}*`,
        case_insensitive: true,
      },
    },
  };
}

/**
 * Helper to build dis_max query with multi_match and wildcard
 */
function buildDisMaxQuery(
  query: string,
  fields: string[],
  wildcardField: string,
): Record<string, unknown> {
  const queries = [
    buildMultiMatchQuery(query, fields),
    buildWildcardQuery(wildcardField, query),
  ];
  return { dis_max: { tie_breaker: 0.7, queries } };
}

function buildSearchError(
  error: unknown,
): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
    details: {},
  };
}

async function executeSearchTool<T, U>(
  searchFn: (q: string) => Promise<T[]>,
  mapper: (item: T) => U,
  contentBuilder: (res: U[]) => string,
  query: string,
): Promise<AgentToolResult<Record<string, unknown>>> {
  try {
    const items = await searchFn(query);
    const results = items.slice(0, 20).map(mapper);
    return buildSearchResult(results, query, contentBuilder);
  } catch (error) {
    return buildSearchError(error);
  }
}

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/20100101 Firefox/138.0",
  Origin: "https://search.nixos.org/",
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Basic ${AUTH_TOKEN}`,
};

async function postNixSearch<T>(
  queryPayload: Record<string, unknown>,
): Promise<T[]> {
  const response = await throttledFetch(SEARCH_URL, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify(queryPayload),
  });

  if (!response.ok)
    throw new Error(`Search request failed: ${response.status}`);

  const data = (await response.json()) as NixSearchResponse<T>;
  return data.hits.hits.map((hit) => hit._source);
}

const PACKAGE_SOURCE_FIELDS = [
  "type",
  "package_attr_name",
  "package_attr_set",
  "package_pname",
  "package_pversion",
  "package_platforms",
  "package_outputs",
  "package_default_output",
  "package_programs",
  "package_mainProgram",
  "package_license",
  "package_license_set",
  "package_maintainers",
  "package_maintainers_set",
  "package_teams",
  "package_teams_set",
  "package_description",
  "package_longDescription",
  "package_hydra",
  "package_system",
  "package_homepage",
  "package_position",
];

const PACKAGE_MUST_FIELDS = [
  "package_attr_name^9",
  "package_attr_name.*^5.3999999999999995",
  "package_programs^9",
  "package_programs.*^5.3999999999999995",
  "package_pname^6",
  "package_pname.*^3.5999999999999996",
  "package_description^1.3",
  "package_description.*^0.78",
  "package_longDescription^1",
  "package_longDescription.*^0.6",
  "flake_name^0.5",
  "flake_name.*^0.3",
];

function buildPackageQuery(query: string): Record<string, unknown> {
  return {
    from: 0,
    size: 50,
    sort: [
      { _score: "desc", package_attr_name: "desc", package_pversion: "desc" },
    ],
    aggs: {
      ...buildAggregationTerms(),
      all: buildCommonAggregations(),
    },
    query: buildPackageQueryClause(query),
    _source: PACKAGE_SOURCE_FIELDS,
    track_total_hits: true,
  };
}

function buildPackageFilterItem(): Record<string, unknown> {
  return { term: { type: { value: "package", _name: "filter_packages" } } };
}

function buildEmptyBoolMustArray(): Record<string, unknown>[] {
  return Array(5).fill({ bool: { should: [] } });
}

function buildPackageQueryClause(query: string): Record<string, unknown> {
  const filter = [
    buildPackageFilterItem(),
    { bool: { must: buildEmptyBoolMustArray() } },
  ];
  return {
    bool: {
      filter,
      must_not: [],
      must: [buildDisMaxQuery(query, PACKAGE_MUST_FIELDS, "package_attr_name")],
    },
  };
}

async function searchNixPackages(query: string): Promise<NixPackage[]> {
  return postNixSearch<NixPackage>(buildPackageQuery(query));
}

function buildOptionFilterItem(): Record<string, unknown> {
  return { term: { type: { value: "option", _name: "filter_options" } } };
}

function buildOptionMustFields(): string[] {
  return [
    "option_name^6",
    "option_name.*^3.5999999999999996",
    "option_description^1",
    "option_description.*^0.6",
    "flake_name^0.5",
    "flake_name.*^0.3",
  ];
}

function buildOptionQuery(query: string): Record<string, unknown> {
  const OPTION_SOURCE_FIELDS = [
    "option_name",
    "option_description",
    "flake_name",
    "option_type",
    "option_default",
    "option_example",
    "option_source",
  ];

  return {
    from: 0,
    size: 50,
    sort: [{ _score: "desc", option_name: "desc" }],
    aggs: buildPackageAggregations(),
    query: {
      bool: {
        filter: [buildOptionFilterItem()],
        must_not: [],
        must: [buildDisMaxQuery(query, buildOptionMustFields(), "option_name")],
      },
    },
    _source: OPTION_SOURCE_FIELDS,
  };
}

function buildPackageAggregations(): Record<string, unknown> {
  return {
    ...buildAggregationTerms(),
    all: buildCommonAggregations(),
  };
}

async function searchNixOptions(query: string): Promise<NixOption[]> {
  return postNixSearch<NixOption>(buildOptionQuery(query));
}

async function searchHomeManagerOptions(
  query: string,
): Promise<HomeManagerOption[]> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    Referer: "https://home-manager-options.extranix.com/?query=&release=master",
    "Sec-GPC": "1",
    Connection: "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    TE: "trailers",
  };

  const response = await throttledFetch(HOME_MANAGER_OPTIONS_URL, {
    method: "GET",
    headers,
  });

  if (!response.ok)
    throw new Error(`Home-Manager options request failed: ${response.status}`);

  const data = (await response.json()) as HomeManagerOptionResponse;

  return data.options.filter(
    (option) =>
      (typeof option.title === "string" &&
        option.title.toLowerCase().includes(query.toLowerCase())) ||
      (typeof option.description === "string" &&
        option.description.toLowerCase().includes(query.toLowerCase())),
  );
}

function mapPackage(item: NixPackage): Record<string, string> {
  return removeEmptyProperties({
    attr_name: item.package_attr_name,
    pname: item.package_pname,
    version: item.package_pversion,
    description: cleanText(item.package_description),
    longDescription: cleanText(item.package_longDescription),
    homepage: Array.isArray(item.package_homepage)
      ? item.package_homepage.join(", ")
      : String(item.package_homepage || ""),
    maintainers: item.package_maintainers
      .map((m) => m.name || m.github)
      .join(", "),
    license: item.package_license_set.join(", "),
  });
}

function formatPackageTable(res: Record<string, string>[]): string {
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
    homepage: Array.isArray(pkg.homepage) ? pkg.homepage[0] || "" : "",
  }));

  return [
    dotJoin(countLabel(res.length, "result")),
    "",
    table(cols, rows),
  ].join("\n");
}

function mapNixOption(opt: NixOption): Record<string, string> {
  return removeEmptyProperties({
    option: opt.option_name,
    description: cleanText(opt.option_description),
    type: opt.option_type,
    default: opt.option_default,
    example: opt.option_example,
    source: opt.option_source,
  });
}

function mapHomeManagerOption(opt: HomeManagerOption): Record<string, string> {
  return removeEmptyProperties({
    option: opt.title,
    description: cleanText(opt.description),
    type: opt.type,
    default: opt.default,
    example: opt.example,
    declarations: opt.declarations.map((d) => d.url).join(", "),
  });
}

function createTool<T>(
  name: string,
  label: string,
  description: string,
  searchFn: (q: string) => Promise<T[]>,
  mapper: (item: T) => Record<string, string>,
  contentBuilder: (res: Record<string, string>[]) => string,
) {
  return {
    name,
    label,
    description,
    parameters: SearchQueryParams,
    async execute(
      _toolCallId: string,
      params: SearchQueryParamsType,
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      return executeSearchTool(
        searchFn as never,
        mapper,
        contentBuilder,
        params.query,
      );
    },
  };
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool(
    createTool(
      "search-nix-packages",
      "Search Nix Packages",
      `Find packages available in the NixOS package repository.

Use this to:
- Discover software packages for installation
- Check package versions and descriptions
- Find packages by name or functionality
- Get package metadata and maintainers

Returns detailed package information from nixpkgs.`,
      searchNixPackages,
      mapPackage,
      formatPackageTable,
    ),
  );

  pi.registerTool(
    createTool(
      "search-nix-options",
      "Search Nix Options",
      `Find configuration options available in NixOS.

Use this to:
- Discover system configuration settings
- Find options for services and modules
- Check option types and default values
- Get examples for configuration

Returns NixOS configuration option details.`,
      searchNixOptions,
      mapNixOption,
      buildOptionTableRenderer(false),
    ),
  );

  pi.registerTool(
    createTool(
      "search-home-manager-options",
      "Search Home-Manager Options",
      `Find configuration options for Home Manager.

Use this to:
- Configure user-specific settings
- Set up dotfiles and user programs
- Customize desktop environment
- Manage user-level services

Returns Home Manager configuration options.`,
      searchHomeManagerOptions,
      mapHomeManagerOption,
      buildOptionTableRenderer(true),
    ),
  );
}
