import { countLabel } from "../../../shared/rendering/labels";
import { table } from "../../../shared/rendering/table/renderer";
import { createCodeSearchColumns } from "../github/formatting";
import type { SourcegraphResult } from "./types";

const cols = createCodeSearchColumns((r) =>
  r.stars ? `${r.stars} ★` : undefined,
);

export function formatSourcegraphResult(result: {
  query: string;
  results: SourcegraphResult[];
}): string {
  const rows = result.results.map((item, i) => ({
    "#": String(i + 1),
    path: `${item.repo}/${item.path}${item.language ? ` · ${item.language}` : ""}`,
    snippet:
      item.snippet.length > 120
        ? item.snippet.slice(0, 120) + "..."
        : item.snippet,
    stars: `${item.stars} ★`,
    url: item.url,
  }));

  const count = countLabel(result.results.length, "result");
  return [count, "", table(cols, rows)].join("\n");
}
