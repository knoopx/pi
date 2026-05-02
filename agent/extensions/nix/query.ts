import { throttledFetch } from "../../shared/throttle";

export const NIXPKGS_GITHUB_BASE =
  "https://github.com/NixOS/nixpkgs/blob/nixos-unstable";

const SEARCH_URL =
  "https://search.nixos.org/backend/nixos-47-unstable-0726a0ecb6d4e08f6adced58726b95db924cef57/_search";
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
