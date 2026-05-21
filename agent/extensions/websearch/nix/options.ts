import { dotJoin, countLabel } from "../../../shared/rendering/labels";
import { table } from "../../../shared/rendering/table/renderer";
import type { Column } from "../../../shared/rendering/types";
import {
  cleanText,
  removeEmptyProperties,
  buildMultiMatchQuery,
  NIXPKGS_GITHUB_BASE,
  searchNix,
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
function appendBasicFields(lines: string[], r: Record<string, string>): void {
  if (r.option) lines.push(r.option);
  if (r.description) lines.push(r.description);
}

function appendExtraFields(
  lines: string[],
  r: Record<string, string>,
  includeDeclarations: boolean,
): void {
  if (r.default) lines.push(`default: ${r.default}`);
  if (r.example) lines.push(`example: ${r.example}`);
  appendDeclarations(lines, r.declarations, includeDeclarations);
  if (r.sourceUrl) lines.push(r.sourceUrl);
}

function appendDeclarations(
  lines: string[],
  declarations: string | undefined,
  includeDeclarations: boolean,
): void {
  if (includeDeclarations && declarations) lines.push(declarations);
}

function formatOptionRow(
  row: Record<string, string>,
  includeDeclarations: boolean,
): string {
  const lines: string[] = [];
  appendBasicFields(lines, row);
  appendExtraFields(lines, row, includeDeclarations);
  return lines.join("\n");
}

function buildOptionRow(
  item: Record<string, string>,
  i: number,
): Record<string, string> {
  return {
    "#": String(i + 1),
    type: orEmpty(item.type),
    option: orEmpty(item.option),
    description: orEmpty(item.description),
    default: orEmpty(item.default),
    example: orEmpty(item.example),
    declarations: item.declarations ?? "",
    sourceUrl: item.sourceUrl ?? "",
  };
}

function orEmpty(value: string): string {
  return value || "";
}

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
          return formatOptionRow(
            row as Record<string, string>,
            includeDeclarations,
          );
        },
      },
    ];
    const rows = res.map(buildOptionRow);

    return [
      dotJoin(countLabel(res.length, "result")),
      "",
      table(cols, rows),
    ].join("\n");
  };
}
function buildOptionQuery(query: string): Record<string, unknown> {
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
    query: buildMultiMatchQuery(query, [
      "option_name",
      "option_description",
      "package_attr_set",
      "package_pname",
      "package_pversion",
    ]),
    size: 100,
  };
}
export async function searchNixOptions(query: string): Promise<NixOption[]> {
  return await searchNix(buildOptionQuery, query);
}
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
export function mapNixOption(opt: NixOption): Record<string, string> {
  const sourceUrl = opt.option_source
    ? `${NIXPKGS_GITHUB_BASE}/${opt.option_source}`
    : undefined;
  return removeEmptyProperties({
    option: opt.option_name,
    description: cleanText(opt.option_description),
    type: opt.option_type,
    default: opt.option_default,
    example: opt.option_example,
    sourceUrl: sourceUrl ?? "",
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
