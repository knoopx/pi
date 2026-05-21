import type { Column } from "../../../shared/rendering/types";
import { countLabel, stateDot } from "../../../shared/rendering/labels";
import { table } from "../../../shared/rendering/table/renderer";
import type { Context7DocResult, Context7Library } from "./types";

const docCols: Column[] = [
  { key: "#", align: "right", minWidth: 3 },
  {
    key: "title",
    format(_v, row) {
      const r = row as Record<string, string>;
      const lines = [r.title];
      if (r.snippet) lines.push(r.snippet);
      lines.push(r.url);
      return lines.join("\n");
    },
  },
];

export function formatContext7Result(result: {
  query: string;
  results: Context7DocResult[];
  library?: { id: string };
}): string {
  if (result.results.length === 0) {
    return "No documentation snippets found.";
  }

  const rows = result.results.map((item, i) => ({
    "#": String(i + 1),
    title: `${item.type === "code" ? stateDot("on") : stateDot("off")} ${item.title}${item.language ? ` · ${item.language}` : ""}`,
    snippet:
      item.snippet.length > 200
        ? item.snippet.slice(0, 200) + "..."
        : item.snippet,
    url: item.url,
  }));

  const libLabel = result.library?.id ? ` · ${result.library.id}` : "";
  const header = `${countLabel(result.results.length, "snippet")}${libLabel}`;
  return [header, "", table(docCols, rows)].join("\n");
}

const libCols: Column[] = [
  { key: "#", align: "right", minWidth: 3 },
  {
    key: "title",
    format(_v, row) {
      const r = row as Record<string, string>;
      const lines = [r.title];
      if (r.description) lines.push(r.description);
      if (r.versions) lines.push(`versions: ${r.versions}`);
      return lines.join("\n");
    },
  },
];

export function formatLibraryList(result: {
  query: string;
  libraries: Context7Library[];
}): string {
  if (result.libraries.length === 0) {
    return `No libraries found for "${result.query}".`;
  }

  const rows = result.libraries.map((lib, i) => ({
    "#": String(i + 1),
    title: `${lib.id} · ${lib.trustScore.toFixed(1)} trust`,
    description: lib.description || "",
    versions: lib.versions.join(", "),
  }));

  const header = countLabel(result.libraries.length, "library");
  return [header, "", table(libCols, rows)].join("\n");
}
