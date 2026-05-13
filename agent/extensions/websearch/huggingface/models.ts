import { Type } from "typebox";
import type { Static } from "typebox";
import type { Column } from "../../../shared/rendering/types";
import { textResult } from "../../../shared/result/tool";
import { dotJoin, countLabel } from "../../../shared/rendering/labels";
import { table } from "../../../shared/rendering/table/renderer";
import { formatIsoAge } from "../../../shared/format/time-formatting";
import { formatDownloadsShort } from "../../../shared/format/text-formatting";
import { extractLicense, filterUserTags } from "../../../shared/format/hf-tags";
import type { ModelSummary } from "./types";
import { HF_API, HF_BASE } from "./helpers";
import { hfFetch, parseCsv, matchesText, isWithinLastDays } from "./helpers";

export const SearchHuggingfaceModelsParams = Type.Object({
  query: Type.String({ description: "Search query (e.g. 'Qwen GGUF')" }),
  filter: Type.Optional(
    Type.String({
      description:
        "Comma-separated tag filters (e.g. 'gguf', 'gguf,text-generation')",
    }),
  ),
  author: Type.Optional(
    Type.String({
      description: "Optional author/org filter (substring match)",
    }),
  ),
  pipeline: Type.Optional(
    Type.String({
      description: "Optional pipeline tag filter (e.g. 'text-generation')",
    }),
  ),
  library: Type.Optional(
    Type.String({
      description: "Optional library filter (e.g. 'transformers')",
    }),
  ),
  updatedWithinDays: Type.Optional(
    Type.Number({
      description: "Only include models updated within N days",
      minimum: 1,
      maximum: 3650,
    }),
  ),
  createdWithinDays: Type.Optional(
    Type.Number({
      description: "Only include models created within N days",
      minimum: 1,
      maximum: 3650,
    }),
  ),
  gated: Type.Optional(
    Type.Boolean({
      description: "Filter by gated status (true/false)",
    }),
  ),
  sort: Type.Optional(Type.String({ enum: ["downloads", "likes", "created"] })),
  limit: Type.Optional(
    Type.Number({
      description: "Number of results (1-50, default 10)",
      minimum: 1,
      maximum: 50,
    }),
  ),
});

export type SearchHuggingfaceModelsParamsType = Static<
  typeof SearchHuggingfaceModelsParams
>;

export async function searchHuggingfaceModels(
  params: SearchHuggingfaceModelsParamsType,
  signal?: AbortSignal,
) {
  const limit = params.limit ?? 10;
  const sort = params.sort ?? "downloads";
  const apiLimit = Math.min(100, Math.max(limit * 3, limit));
  const qs = new URLSearchParams({
    search: params.query,
    sort,
    direction: "-1",
    limit: String(apiLimit),
    full: "true",
  });
  if (params.filter) qs.set("filter", params.filter);

  const models = await hfFetch<ModelSummary[]>(
    `${HF_API}/models?${qs}`,
    signal,
  );

  const tagFilters = parseCsv(params.filter).map((tag) => tag.toLowerCase());
  const filtered = models
    .filter((m) =>
      tagFilters.every((tag) =>
        m.tags.some((candidate) => candidate.toLowerCase() === tag),
      ),
    )
    .filter((m) => matchesText(m.author, params.author))
    .filter((m) => matchesText(m.pipeline_tag, params.pipeline))
    .filter((m) => matchesText(m.library_name, params.library))
    .filter((m) => {
      if (params.updatedWithinDays === undefined) return true;
      return isWithinLastDays(m.lastModified, params.updatedWithinDays);
    })
    .filter((m) => {
      if (params.createdWithinDays === undefined) return true;
      return isWithinLastDays(m.createdAt, params.createdWithinDays);
    })
    .filter((m) => {
      if (params.gated === undefined) return true;
      const isGated = m.gated !== false;
      return params.gated ? isGated : !isGated;
    })
    .slice(0, limit);

  if (!filtered.length) {
    return textResult(
      `No models found for "${params.query}" with current filters.`,
      { query: params.query, filters: params },
    );
  }

  const rows = filtered.map((m) => {
    const allTags = filterUserTags(m.tags);
    const tags = allTags
      .filter((t) => t !== m.pipeline_tag && t !== m.library_name)
      .slice(0, 3)
      .join(", ");
    return {
      Model: m.id,
      url: `${HF_BASE}/models/${m.id}`,
      "󰇚": formatDownloadsShort(m.downloads),
      "󰋑": m.likes,
      License: extractLicense(m.tags, m.cardData) ?? "",
      Pipeline: m.pipeline_tag ?? "",
      Tags: tags,
      Updated: m.lastModified ? formatIsoAge(m.lastModified) : "",
    };
  });

  const searchCols: Column[] = [
    { key: "󰇚", align: "right", minWidth: 7 },
    { key: "󰋑", align: "right", minWidth: 4 },
    {
      key: "model",
      format: (_v: unknown, row: Record<string, unknown>) => {
        const r = row as Record<string, string>;
        const meta: string[] = [];
        if (r.License) meta.push(r.License);
        if (r.Pipeline) meta.push(r.Pipeline);
        const lines = [r.model];
        if (meta.length > 0) lines.push(meta.join(" · "));
        const tagLine: string[] = [];
        if (r.Tags) tagLine.push(r.Tags);
        if (r.Updated) tagLine.push(`updated ${r.Updated}`);
        if (tagLine.length > 0) lines.push(tagLine.join(" · "));
        if (r.url) lines.push(r.url);
        return lines.join("\n");
      },
    },
  ];
  const tableRows = rows.map((r) => ({
    "󰇚": r["󰇚"],
    "󰋑": String(r["󰋑"]),
    model: r.Model,
    url: r.url,
    License: r.License,
    Pipeline: r.Pipeline,
    Tags: r.Tags,
    Updated: r.Updated,
  }));

  const header = dotJoin(countLabel(filtered.length, "result"));
  return textResult([header, "", table(searchCols, tableRows)].join("\n"), {
    query: params.query,
    filters: params,
    models: filtered.map((m) => ({
      id: m.id,
      downloads: m.downloads,
      likes: m.likes,
      license: extractLicense(m.tags, m.cardData),
      pipeline_tag: m.pipeline_tag,
      library_name: m.library_name,
      createdAt: m.createdAt,
      lastModified: m.lastModified,
    })),
  });
}
