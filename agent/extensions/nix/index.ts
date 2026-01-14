import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

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

interface NixFlake {
  type: string;
  flake_description: string;
  flake_resolved: {
    type: string;
    url: string;
  };
  flake_name: string;
  revision: string;
  flake_source: {
    type: string;
    url: string;
  };
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
    name: string | null;
    github: string;
    email: string | null;
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
  package_description: string;
  package_longDescription: string | null;
  package_hydra: unknown | null;
  package_system: string;
  package_homepage: string[];
  package_position: string | null;
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

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  user: GitHubUser | null;
  updated_at: string;
  pull_request?: {
    merged_at: string | null;
  };
}

interface GitHubUser {
  login: string;
  name?: string | null;
  email?: string | null;
}

interface NixSearchResponse<T> {
  hits: {
    hits: Array<{ _source: T }>;
  };
}

interface GitHubPullRequest {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  user: GitHubUser | null;
  created_at: string;
  updated_at: string;
  body: string | null;
  merged_at: string | null;
  requested_reviewers: GitHubUser[];
  availableOn: string[];
  head: {
    ref: string;
  } | null;
  base: {
    ref: string;
  } | null;
}

const SEARCH_URL =
  "https://search.nixos.org/backend/latest-44-nixos-unstable/_search";
const FLAKE_SEARCH_URL =
  "https://search.nixos.org/backend/latest-44-group-manual/_search";
const AUTH_TOKEN = "YVdWU0FMWHBadjpYOGdQSG56TDUyd0ZFZWt1eHNmUTljU2g=";
const HOME_MANAGER_OPTIONS_URL =
  "https://home-manager-options.extranix.com/data/options-master.json";

function cleanText(text: string | null): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").trim();
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

async function searchNixOptions(query: string): Promise<NixOption[]> {
  const queryPayload = {
    from: 0,
    size: 50,
    sort: [{ _score: "desc", option_name: "desc" }],
    aggs: {
      all: {
        global: {},
        aggregations: {},
      },
    },
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

async function searchNixFlakes(query: string): Promise<NixFlake[]> {
  const queryPayload = createPackageQueryPayload(query, [
    "type",
    "flake_description",
    "flake_resolved",
    "flake_name",
    "revision",
    "flake_source",
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

  const response = await fetch(FLAKE_SEARCH_URL, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify(queryPayload),
  });

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`);
  }

  const data = (await response.json()) as NixSearchResponse<NixFlake>;
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

async function searchNixpkgsPullRequests(
  query: string,
): Promise<GitHubIssue[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(
    query,
  )}+repo:NixOS/nixpkgs+type:pr`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);

  const json = (await res.json()) as any;
  return json.items.filter((i: GitHubIssue) => i.pull_request || !query.trim());
}

export default function (pi: ExtensionAPI) {
  // Search Nix packages
  pi.registerTool({
    name: "search-nix-packages",
    label: "Search Nix Packages",
    description:
      "Search for Nix packages from the official NixOS repositories. Returns package details including name, version, description, maintainers, and more.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (package name, description, or programs)",
      }),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const { query } = params as { query: string };

      try {
        const packages = await searchNixPackages(query);

        const results = packages.slice(0, 20).map((pkg) => ({
          attr_name: pkg.package_attr_name,
          pname: pkg.package_pname,
          version: pkg.package_pversion,
          description: cleanText(pkg.package_description),
          longDescription: cleanText(pkg.package_longDescription),
          platforms: pkg.package_platforms,
          homepage: pkg.package_homepage,
          maintainers: pkg.package_maintainers
            .map((m) => m.name || m.github)
            .join(", "),
          license: pkg.package_license_set.join(", "),
        }));

        return buildSearchResult(results, query, (res) => {
          let c = `Found ${res.length} packages matching "${query}":\n\n`;
          res.forEach((pkg) => {
            c += `**${pkg.attr_name}** (${pkg.pname} ${pkg.version})\n`;
            c += `Description: ${pkg.description || "N/A"}\n`;
            if (pkg.longDescription) c += `Details: ${pkg.longDescription}\n`;
            c += `Platforms: ${pkg.platforms.join(", ")}\n`;
            if (pkg.homepage.length > 0) c += `Homepage: ${pkg.homepage[0]}\n`;
            c += `Maintainers: ${pkg.maintainers}\n`;
            c += `License: ${pkg.license}\n\n`;
          });
          return c;
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching Nix packages: ${(error as Error).message}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  // Search Nix options
  pi.registerTool({
    name: "search-nix-options",
    label: "Search Nix Options",
    description:
      "Search for NixOS configuration options from the official NixOS repositories.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (option name or description)",
      }),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const { query } = params as { query: string };

      try {
        const options = await searchNixOptions(query);

        const results = options.slice(0, 20).map((opt) => ({
          name: opt.option_name,
          description: cleanText(opt.option_description),
          type: opt.option_type,
          default: opt.option_default,
          example: opt.option_example,
          source: opt.option_source,
        }));

        return buildSearchResult(results, query, (res) => {
          let c = `Found ${res.length} options matching "${query}":\n\n`;
          res.forEach((opt) => {
            c += `**${opt.name}**\n`;
            c += `Description: ${opt.description}\n`;
            c += `Type: ${opt.type}\n`;
            if (opt.default) c += `Default: ${opt.default}\n`;
            if (opt.example) c += `Example: ${opt.example}\n`;
            if (opt.source) c += `Source: ${opt.source}\n\n`;
          });
          return c;
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching Nix options: ${(error as Error).message}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  // Search Nix flake packages
  pi.registerTool({
    name: "search-nix-flake-packages",
    label: "Search Nix Flake Packages",
    description:
      "Search for packages from Nix flakes in the official repositories.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (package name, description, or programs)",
      }),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const { query } = params as { query: string };

      try {
        const flakes = await searchNixFlakes(query);

        const results = flakes.slice(0, 20).map((flake) => ({
          flake_name: flake.flake_name,
          attr_name: flake.package_attr_name,
          pname: flake.package_pname,
          version: flake.package_pversion,
          description: cleanText(flake.package_description),
          longDescription: cleanText(flake.package_longDescription),
          platforms: flake.package_platforms,
          homepage: flake.package_homepage,
          maintainers: flake.package_maintainers
            .map((m) => m?.name || m?.github || "unknown")
            .join(", "),
          license: flake.package_license_set.join(", "),
          flake_url: flake.flake_source.url,
        }));

        return buildSearchResult(results, query, (res) => {
          let c = `Found ${res.length} flake packages matching "${query}":\n\n`;
          res.forEach((pkg) => {
            c += `**${pkg.flake_name}#${pkg.attr_name}** (${pkg.pname} ${pkg.version})\n`;
            c += `Description: ${pkg.description || "N/A"}\n`;
            if (pkg.longDescription) c += `Details: ${pkg.longDescription}\n`;
            c += `Platforms: ${pkg.platforms.join(", ")}\n`;
            if (pkg.homepage.length > 0) c += `Homepage: ${pkg.homepage[0]}\n`;
            c += `Maintainers: ${pkg.maintainers}\n`;
            c += `License: ${pkg.license}\n`;
            c += `Flake: ${pkg.flake_url}\n\n`;
          });
          return c;
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching Nix flake packages: ${(error as Error).message}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  // Search Home-Manager options
  pi.registerTool({
    name: "search-home-manager-options",
    label: "Search Home-Manager Options",
    description: "Search for Home-Manager configuration options.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (option name or description)",
      }),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const { query } = params as { query: string };

      try {
        const options = await searchHomeManagerOptions(query);

        const results = options.slice(0, 20).map((opt) => ({
          title: opt.title,
          description: cleanText(opt.description),
          type: opt.type,
          default: opt.default,
          example: opt.example,
          declarations: opt.declarations.map((d) => d.url).join(", "),
        }));

        return buildSearchResult(results, query, (res) => {
          let c = `Found ${res.length} Home-Manager options matching "${query}":\n\n`;
          res.forEach((opt) => {
            c += `**${opt.title}**\n`;
            c += `Description: ${opt.description}\n`;
            c += `Type: ${opt.type}\n`;
            c += `Default: ${opt.default}\n`;
            if (opt.example) c += `Example: ${opt.example}\n`;
            if (opt.declarations) c += `Declarations: ${opt.declarations}\n\n`;
          });
          return c;
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching Home-Manager options: ${(error as Error).message}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  // Search Nixpkgs pull requests
  pi.registerTool({
    name: "search-nixpkgs-pull-requests",
    label: "Search Nixpkgs Pull Requests",
    description:
      "Search for pull requests in the NixOS/nixpkgs repository on GitHub.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (title, number, or keywords)",
      }),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const { query } = params as { query: string };

      try {
        const prs = await searchNixpkgsPullRequests(query);

        const results = prs.slice(0, 20).map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          user: pr.user?.login || "unknown",
          updated_at: pr.updated_at,
          url: pr.html_url,
        }));

        return buildSearchResult(results, query, (res) => {
          let c = `Found ${res.length} pull requests matching "${query}":\n\n`;
          res.forEach((pr) => {
            c += `**#${pr.number}**: ${pr.title}\n`;
            c += `State: ${pr.state}\n`;
            c += `Author: ${pr.user}\n`;
            c += `Updated: ${pr.updated_at}\n`;
            c += `URL: ${pr.url}\n\n`;
          });
          return c;
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching Nixpkgs pull requests: ${(error as Error).message}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });
}
