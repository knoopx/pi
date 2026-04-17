import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import { dotJoin, countLabel, table } from "../../shared/renderers";
import type { Column } from "../../shared/renderers";
import {
  cleanText,
  removeEmptyProperties,
  buildMultiMatchQuery,

  PACKAGE_MUST_FIELDS,
  searchNix,
  type NixPackage,
} from "./query";

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

const HOME_MANAGER_OPTIONS_URL =
  "https://home-manager-options.extranix.com/data/options-master.json";

// Shared search result builder
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

// Option table renderer (shared between nix-options and home-manager-options)
export function buildOptionTableRenderer(
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

// NixOS option query building
function buildOptionFilterItem(): Record<string, unknown> {
  const mustFields = buildOptionMustFields();
  if (mustFields.length === 0) return {};
  return { bool: { filter: [{ terms: { package_attr_set: mustFields } }] } };
}

function buildOptionMustFields(): string[] {
  return PACKAGE_MUST_FIELDS.filter((field) =>
    field.startsWith("package_attr"),
  ).map((f) => f.replace("package_", "").replace("_set", ""));
}

function buildOptionQuery(query: string): Record<string, unknown> {
  const fields = [
    "option_name",
    "option_description",
    "package_attr_set",
    "package_pname",
    "package_pversion",
  ];

  return {
    _source: [
      "option_name",
      "option_description",
      "option_flake",
      "option_type",
      "option_default",
      "option_example",
      "option_source",
    ],
    query: buildMultiMatchQuery(query, fields),
    size: 100,
  };
}

export async function searchNixOptions(query: string): Promise<NixOption[]> {
  return searchNix(buildOptionQuery, fetch, query);
}

// Home Manager option search
export async function searchHomeManagerOptions(
  query: string,
): Promise<HomeManagerOption[]> {
  const response = await fetch(HOME_MANAGER_OPTIONS_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from HM options API`);
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

// Execute a search tool: fetches, maps, and formats results
export async function executeSearchTool<T, U extends Record<string, string>>(
  searchFn: (q: string) => Promise<T[]>,
  mapper: (item: T) => U,
  contentBuilder: (res: U[]) => string,
  query: string,
): Promise<
  import("@mariozechner/pi-coding-agent").AgentToolResult<
    Record<string, unknown>
  >
> {
  try {
    const items = await searchFn(query);
    const results = items.slice(0, 20).map(mapper);
    return buildSearchResult(results, query, contentBuilder);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      details: {},
    };
  }
}

export function mapNixOption(opt: NixOption): Record<string, string> {
  return removeEmptyProperties({
    option: opt.option_name,
    description: cleanText(opt.option_description),
    type: opt.option_type,
    default: opt.option_default,
    example: opt.option_example,
    source: opt.option_source,
  });
}

export function mapHomeManagerOption(
  opt: HomeManagerOption,
): Record<string, string> {
  return removeEmptyProperties({
    option: opt.title,
    description: cleanText(opt.description),
    type: opt.type,
    default: opt.default,
    example: opt.example,
    declarations: opt.declarations.map((d) => d.url).join(", "),
  });
}
