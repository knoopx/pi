import { throttledFetch } from "../../shared/throttle";

// GitHub base URL for nixpkgs source links.
export const NIXPKGS_GITHUB_BASE =
  "https://github.com/NixOS/nixpkgs/blob/nixos-unstable";

// NixOS search index — points to the latest nixos-unstable snapshot.
// To find the current index, run:
//   curl -s -H "Authorization: Bearer $NIX_SEARCH_TOKEN" \
//     "https://search.nixos.org/backend/_cat/indices" | grep nixos.*unstable
// Pick the row with the highest group number (e.g. nixos-47-unstable-...).
const SEARCH_URL =
  "https://search.nixos.org/backend/nixos-47-unstable-b12141ef619e0a9c1c84dc8c684040326f27cdcc/_search";

const AUTH_TOKEN =
  process.env.NIX_SEARCH_TOKEN ??
  "YVdWU0FMWHBadjpYOGdQSG56TDUyd0ZFZWt1eHNmUTljU2g=";

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

const COMMON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

// Fields searched for package queries
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
  const response = await throttledFetch(SEARCH_URL, {
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
