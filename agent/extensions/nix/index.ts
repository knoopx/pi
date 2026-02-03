import type {
  ExtensionAPI,
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";

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
  package_license: Array<{
    url: string;
    fullName: string;
  }>;
  package_license_set: string[];
  package_maintainers: Array<{
    name: string;
    github: string;
    email: string;
  }>;
  package_maintainers_set: string[];
  package_teams: Array<{
    members: Array<{
      name: string;
      github: string;
      email: string;
    }>;
    scope: string;
    shortName: string;
    githubTeams: string[];
  }>;
  package_teams_set: string[];
  package_description: string | null;
  package_longDescription: string | null;
  package_hydra: { [key: string]: unknown } | null;
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
  declarations: Array<{
    name: string;
    url: string;
  }>;
  loc: string[];
  readOnly: boolean;
}

interface HomeManagerOptionResponse {
  last_update: string;
  options: HomeManagerOption[];
}

interface NixSearchResponse<T> {
  hits: {
    hits: Array<{ _source: T }>;
  };
}

const SEARCH_URL =
  "https://search.nixos.org/backend/latest-44-nixos-unstable/_search";
const AUTH_TOKEN = "YVdWU0FMWHBadjpYOGdQSG56TDUyd0ZFZWt1eHNmUTljU2g=";
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
    ) {
      result[key as keyof T] = value as T[keyof T];
    }
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
 * Helper function to build common aggregations structure
 */
function buildCommonAggregations(): Record<string, unknown> {
  return {
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
    return {
      content: [
        {
          type: "text",
          text: `Error: ${(error as Error).message}`,
        },
      ],
      details: {},
    };
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

function createPackageQueryPayload(query: string, sourceFields: string[]) {
  return {
    from: 0,
    size: 50,
    sort: [
      { _score: "desc", package_attr_name: "desc", package_pversion: "desc" },
    ],
    aggs: {
      package_attr_set: { terms: { field: "package_attr_set", size: 20 } },
      package_license_set: {
        terms: { field: "package_license_set", size: 20 },
      },
      package_maintainers_set: {
        terms: { field: "package_maintainers_set", size: 20 },
      },
      package_teams_set: { terms: { field: "package_teams_set", size: 20 } },
      package_platforms: { terms: { field: "package_platforms", size: 20 } },
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
    },
    query: {
      bool: {
        filter: [
          { term: { type: { value: "package", _name: "filter_packages" } } },
          {
            bool: {
              must: [
                { bool: { should: [] } },
                { bool: { should: [] } },
                { bool: { should: [] } },
                { bool: { should: [] } },
                { bool: { should: [] } },
              ],
            },
          },
        ],
        must_not: [],
        must: [
          {
            dis_max: {
              tie_breaker: 0.7,
              queries: [
                {
                  multi_match: {
                    type: "cross_fields",
                    query: query,
                    analyzer: "whitespace",
                    auto_generate_synonyms_phrase_query: false,
                    operator: "and",
                    _name: `multi_match_${query}`,
                    fields: [
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
                    ],
                  },
                },
                {
                  wildcard: {
                    package_attr_name: {
                      value: `*${query}*`,
                      case_insensitive: true,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
    _source: sourceFields,
    track_total_hits: true,
  };
}

async function searchNixPackages(query: string): Promise<NixPackage[]> {
  const queryPayload = createPackageQueryPayload(query, [
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
  ]);

  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify(queryPayload),
  });

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`);
  }

  const data = (await response.json()) as NixSearchResponse<NixPackage>;
  return data.hits.hits.map((hit) => hit._source);
}

function buildPackageAggregations(): Record<string, unknown> {
  return {
    global: {},
    aggregations: buildCommonAggregations(),
  };
}

async function searchNixOptions(query: string): Promise<NixOption[]> {
  const queryPayload = {
    from: 0,
    size: 50,
    sort: [{ _score: "desc", option_name: "desc" }],
    aggs: buildPackageAggregations(),
    query: {
      bool: {
        filter: [
          { term: { type: { value: "option", _name: "filter_options" } } },
        ],
        must_not: [],
        must: [
          {
            dis_max: {
              tie_breaker: 0.7,
              queries: [
                {
                  multi_match: {
                    type: "cross_fields",
                    query: query,
                    analyzer: "whitespace",
                    auto_generate_synonyms_phrase_query: false,
                    operator: "and",
                    _name: `multi_match_${query}`,
                    fields: [
                      "option_name^6",
                      "option_name.*^3.5999999999999996",
                      "option_description^1",
                      "option_description.*^0.6",
                      "flake_name^0.5",
                      "flake_name.*^0.3",
                    ],
                  },
                },
                {
                  wildcard: {
                    option_name: {
                      value: `*${query}*`,
                      case_insensitive: true,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
    _source: [
      "option_name",
      "option_description",
      "flake_name",
      "option_type",
      "option_default",
      "option_example",
      "option_source",
    ],
  };

  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify(queryPayload),
  });

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`);
  }

  const data = (await response.json()) as NixSearchResponse<NixOption>;
  return data.hits.hits.map((hit) => hit._source);
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

  const response = await fetch(HOME_MANAGER_OPTIONS_URL, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Home-Manager options request failed: ${response.status}`);
  }

  const data = (await response.json()) as HomeManagerOptionResponse;

  return data.options.filter(
    (option) =>
      (typeof option.title === "string" &&
        option.title.toLowerCase().includes(query.toLowerCase())) ||
      (typeof option.description === "string" &&
        option.description.toLowerCase().includes(query.toLowerCase())),
  );
}

export default function (pi: ExtensionAPI) {
  // Search Nix packages
  pi.registerTool({
    name: "search-nix-packages",
    label: "Search Nix Packages",
    description: `Find packages available in the NixOS package repository.

Use this to:
- Discover software packages for installation
- Check package versions and descriptions
- Find packages by name or functionality
- Get package metadata and maintainers

Returns detailed package information from nixpkgs.`,
    parameters: SearchQueryParams,
    async execute(
      _toolCallId: string,
      params: SearchQueryParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      const { query } = params;

      return executeSearchTool(
        searchNixPackages,
        (item: NixPackage) =>
          removeEmptyProperties({
            attr_name: item.package_attr_name,
            pname: item.package_pname,
            version: item.package_pversion,
            description: cleanText(item.package_description),
            longDescription: cleanText(item.package_longDescription),
            homepage: item.package_homepage,
            maintainers: item.package_maintainers
              .map((m) => m.name || m.github)
              .join(", "),
            license: item.package_license_set.join(", "),
          }),
        (res) => {
          return res
            .map((pkg) => {
              let line = `${pkg.attr_name} ${pkg.pname} ${pkg.version}: ${pkg.description || "-"} [${pkg.maintainers}]`;
              if (pkg.longDescription) line += ` ${pkg.longDescription}`;
              if (pkg.homepage?.[0]) line += ` ${pkg.homepage[0]}`;
              if (pkg.license) line += ` ${pkg.license}`;
              return line;
            })
            .join("\n");
        },
        query,
      );
    },
  });

  // Search Nix options
  pi.registerTool({
    name: "search-nix-options",
    label: "Search Nix Options",
    description: `Find configuration options available in NixOS.

Use this to:
- Discover system configuration settings
- Find options for services and modules
- Check option types and default values
- Get examples for configuration

Returns NixOS configuration option details.`,
    parameters: SearchQueryParams,
    async execute(
      _toolCallId: string,
      params: SearchQueryParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      const { query } = params;

      return executeSearchTool(
        searchNixOptions,
        (opt: NixOption) =>
          removeEmptyProperties({
            name: opt.option_name,
            description: cleanText(opt.option_description),
            type: opt.option_type,
            default: opt.option_default,
            example: opt.option_example,
            source: opt.option_source,
          }),
        (res) => {
          return res
            .map((opt) => {
              let line = `${opt.name}: ${opt.description} ${opt.type}`;
              if (opt.default) line += ` ${opt.default}`;
              if (opt.example) line += ` ${opt.example}`;
              if (opt.source) line += ` ${opt.source}`;
              return line;
            })
            .join("\n");
        },
        query,
      );
    },
  });

  // Search Home-Manager options
  pi.registerTool({
    name: "search-home-manager-options",
    label: "Search Home-Manager Options",
    description: `Find configuration options for Home Manager.

Use this to:
- Configure user-specific settings
- Set up dotfiles and user programs
- Customize desktop environment
- Manage user-level services

Returns Home Manager configuration options.`,
    parameters: SearchQueryParams,
    async execute(
      _toolCallId: string,
      params: SearchQueryParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      const { query } = params;

      return executeSearchTool(
        searchHomeManagerOptions,
        (opt: HomeManagerOption) =>
          removeEmptyProperties({
            title: opt.title,
            description: cleanText(opt.description),
            type: opt.type,
            default: opt.default,
            example: opt.example,
            declarations: opt.declarations.map((d) => d.url).join(", "),
          }),
        (res) => {
          return res
            .map((opt) => {
              let line = `${opt.title}: ${opt.description} ${opt.type} ${opt.default}`;
              if (opt.example) line += ` ${opt.example}`;
              if (opt.declarations) line += ` ${opt.declarations}`;
              return line;
            })
            .join("\n");
        },
        query,
      );
    },
  });
}
