import { throttledFetch } from "../../../shared/network/throttle";

export const NIXPKGS_GITHUB_BASE =
  "https://github.com/NixOS/nixpkgs/blob/nixos-unstable";

const NIX_SEARCH_CHANNEL = "nixos-unstable";
const SEARCH_BASE_URL = "https://search.nixos.org/backend";
const AUTH_TOKEN =
  process.env.NIX_SEARCH_TOKEN ??
  "YVdWU0FMWHBadjpYOGdQSG56TDUyd0ZFZWt1eHNmUTljU2g=";

const COMMON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

interface SearchConfig {
  searchUrl: string | null;
}

const searchConfig: SearchConfig = { searchUrl: null };

export function resetSearchUrlCache(): void {
  searchConfig.searchUrl = null;
}

async function resolveSearchUrl(): Promise<string> {
  if (searchConfig.searchUrl) return searchConfig.searchUrl;

  const indicesResponse = await throttledFetch(
    `${SEARCH_BASE_URL}/_cat/indices?v&h=index`,
    {
      headers: COMMON_HEADERS,
    },
  );

  if (!indicesResponse.ok) {
    throw new Error(
      `HTTP ${indicesResponse.status} from Nix search API while discovering indices`,
    );
  }

  const body = await indicesResponse.text();
  const lines = body.trim().split("\n").slice(1);

  let bestVersion = 0;
  for (const line of lines) {
    const match = line.match(/^nixos-(\d+)-unstable-/);
    if (match) {
      const version = parseInt(match[1], 10);
      if (version > bestVersion) {
        bestVersion = version;
      }
    }
  }

  if (bestVersion === 0) {
    throw new Error("No nixos-*-unstable index found");
  }

  searchConfig.searchUrl = `${SEARCH_BASE_URL}/latest-${bestVersion}-${NIX_SEARCH_CHANNEL}/_search`;
  return searchConfig.searchUrl;
}

interface NixPackage {
  type: "package";
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
  package_description: string;
  package_longDescription: string | null;
  package_hydra: Record<string, unknown> | null;
  package_system: string;
  package_homepage: string[];
  package_position?: string;
}
interface NixSearchResponse<T> {
  hits: {
    hits: { _source: T }[];
  };
}
export function cleanText(text: string | null): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").trim();
}
export function removeEmptyProperties<T extends Record<string, unknown>>(
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
export const PACKAGE_SEARCH_FIELDS = [
  "package_attr_name",
  "package_pname",
  "package_description",
];
export function buildMultiMatchQuery(
  query: string,
  fields: string[],
): Record<string, unknown> {
  return {
    multi_match: {
      query,
      fields,
      type: "best_fields",
    },
  };
}
export function buildDisMaxQuery(
  queries: Record<string, unknown>[],
): Record<string, unknown> {
  return {
    bool: {
      should: queries,
      minimum_should_match: 1,
    },
  };
}
export async function searchNix<T>(
  buildQuery: (query: string) => Record<string, unknown>,
  query: string,
): Promise<T[]> {
  const body = buildQuery(query);
  const url = await resolveSearchUrl();
  const response = await throttledFetch(url, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from Nix search API`);
  }
  const data = (await response.json()) as NixSearchResponse<T>;
  return data.hits.hits.map((hit) => hit._source);
}
export { type NixPackage };
