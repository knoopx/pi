import { stateDot } from "../../shared/rendering/header";
import { table } from "../../shared/rendering/table/renderer";
import type { Column } from "../../shared/rendering/types";

export interface SearchResultRow extends Record<string, unknown> {
  "#": string;
  title: string;
  state: string;
  repo: string;
  labels: string;
  url: string;
  date?: string;
  created?: string;
  updated?: string;
  mergeable?: string;
}

export interface GHListItemResult {
  number: number;
  title: string;
  state: string;
  owner: string;
  repo: string;
  createdAt: string;
  labels: Array<{ name: string }>;
  url: string;
}

export interface ListItemFormatOptions<Item extends GHListItemResult> {
  countLabel: (total: number) => string;
  titleBadge?: (row: SearchResultRow) => string;
  subtitleLine?: (row: SearchResultRow) => string;
  additionalFields?: (item: Item) => Record<string, string>;
}

function formatSearchResult<TItem, TRow extends SearchResultRow>(
  result: { query: string; results: TItem[]; total: number },
  rowMapper: (item: TItem, index: number) => TRow,
  titleFormatter: (row: TRow) => string,
  countLabelFn: (total: number) => string,
): string {
  const cols: Column[] = [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format: (_v, row) => titleFormatter(row as TRow),
    },
  ];

  const rows = result.results.map(rowMapper);
  return [countLabelFn(result.total), "", table(cols, rows)].join("\n");
}

export function createListItemFormatter<Item extends GHListItemResult>(
  options: ListItemFormatOptions<Item>,
): (result: { query: string; results: Item[]; total: number }) => string {
  return (result) => {
    const rowMapper = (item: Item) => ({
      "#": `#${item.number}`,
      title: item.title,
      state: item.state,
      repo: `${item.owner}/${item.repo}`,
      labels: item.labels.map((l) => l.name).join(", "),
      url: item.url,
      ...(options.additionalFields?.(item) ?? {}),
    });
    const titleFormatter = (row: SearchResultRow) => {
      const dot = row.state === "open" ? stateDot("on") : stateDot("off");
      const badge = options.titleBadge?.(row) ?? "";
      const subtitle =
        options.subtitleLine?.(row) ?? `${row.repo} · ${row.date}`;
      const lines = [`${dot} ${row.title}${badge ? ` ${badge}` : ""}`];
      lines.push(subtitle);
      if (row.labels) lines.push(row.labels);
      lines.push(row.url);
      return lines.join("\n");
    };

    return formatSearchResult(
      result,
      rowMapper,
      titleFormatter,
      options.countLabel,
    );
  };
}
