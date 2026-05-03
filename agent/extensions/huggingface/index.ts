import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { textResult } from "../../shared/result/tool-result";
import { throttledFetch } from "../../shared/network/throttle";
import { dotJoin, countLabel, stateDot } from "../../shared/rendering/header";
import { formatIsoAge, extractLicense } from "../transcribe/lib/formatters";
import { detail } from "../../shared/rendering/detail";
import { table } from "../../shared/rendering/table/renderer";
import type { Column } from "../../shared/rendering/types";

const HF_API = "https://huggingface.co/api";
const HF_BASE = "https://huggingface.co";
const HF_UA = { "User-Agent": "pi-huggingface-tool/1.0" };

function renderData(
  data: Record<string, unknown> | Record<string, unknown>[],
): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return "";
    const keys = Object.keys(data[0]);
    const cols: Column[] = keys.map((k) => ({ key: k }));
    return table(cols, data);
  }
  return detail(
    Object.entries(data)
      .filter(([, v]) => v !== "" && v !== undefined && v !== null)
      .map(([k, v]) => ({ label: k, value: String(v) })),
  );
}

interface Author {
  name: string;
  fullname?: string;
  type?: string;
  isPro?: boolean;
  isHf?: boolean;
  isOrgMember?: boolean;
  followerCount?: number;
}

interface CardData {
  license?: string;
  license_link?: string;
  base_model?: string | string[];
  language?: string[];
  tags?: string[];
  datasets?: string[];
  pipeline_tag?: string;
}

interface ModelSummary {
  id: string;
  modelId: string;
  author?: string;
  sha: string;
  downloads: number;
  likes: number;
  tags: string[];
  cardData?: CardData;
  pipeline_tag?: string;
  library_name?: string;
  lastModified?: string;
  createdAt: string;
  gated: boolean | string;
  private: boolean;
}

interface Discussion {
  num: number;
  title: string;
  status: string;
  isPullRequest: boolean;
  pinned: boolean;
  createdAt: string;
  numComments: number;
  numReactionUsers: number;
  topReactions: { reaction: string; count: number }[];
  author: Author;
  repoOwner?: { name: string; isParticipating: boolean; type: string };
}

interface DiscussionList {
  discussions: Discussion[];
  count: number;
  start: number;
  numClosedDiscussions: number;
}

async function hfFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await throttledFetch(url, { signal, headers: HF_UA });
  if (!response.ok) throw new Error(`HF API returned HTTP ${response.status}`);
  return (await response.json()) as T;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function parseCsv(input?: string): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function isWithinLastDays(iso: string | undefined, days: number): boolean {
  if (!iso) return false;
  if (!Number.isFinite(days) || days < 1) return true;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then <= days * 86_400_000;
}

function matchesText(
  value: string | undefined,
  needle: string | undefined,
): boolean {
  if (!needle) return true;
  if (!value) return false;
  return value.toLowerCase().includes(needle.toLowerCase());
}

function totalReactions(reactions: { count: number }[]): number {
  return reactions.reduce((sum, reaction) => sum + reaction.count, 0);
}

function fmtAuthor(a: Author): string {
  const parts = [a.name];
  if (a.fullname && a.fullname !== a.name) parts.push(`(${a.fullname})`);
  const badges: string[] = [];
  if (a.type === "org") badges.push("org");
  if (a.isPro) badges.push("PRO");
  if (a.isHf) badges.push("HF staff");
  if (a.isOrgMember) badges.push("member");
  if (badges.length) parts.push(`[${badges.join(", ")}]`);
  if (a.followerCount) parts.push(`${fmtNum(a.followerCount)} followers`);
  return parts.join(" ");
}

export default function (pi: ExtensionAPI) {
  // ── search-huggingface-models ──────────────────────────────────────

  pi.registerTool({
    name: "search-huggingface-models",
    label: "HuggingFace Search",
    description:
      "Search Hugging Face models. Filter by tags like 'gguf', 'text-generation', 'llama'. Returns model ID, downloads, likes, and tags.",
    parameters: Type.Object({
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
      sort: Type.Optional(
        Type.String({ enum: ["downloads", "likes", "created"] }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Number of results (1-50, default 10)",
          minimum: 1,
          maximum: 50,
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
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

      const tagFilters = parseCsv(params.filter).map((tag) =>
        tag.toLowerCase(),
      );
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
          {
            query: params.query,
            filters: params,
          },
        );
      }

      const rows = filtered.map((m) => {
        const tags = m.tags
          .filter(
            (t) =>
              !t.startsWith("base_model:") &&
              !t.startsWith("license:") &&
              !t.startsWith("arxiv:") &&
              !t.startsWith("deploy:") &&
              !t.startsWith("dataset:") &&
              t !== "region:us" &&
              t !== "endpoints_compatible" &&
              t !== m.pipeline_tag &&
              t !== m.library_name,
          )
          .slice(0, 3)
          .join(", ");
        return {
          Model: m.id,
          url: `${HF_BASE}/models/${m.id}`,
          "󰇚": fmtNum(m.downloads),
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
    },
  });

  // ── list-huggingface-discussions ───────────────────────────────────

  pi.registerTool({
    name: "list-huggingface-discussions",
    label: "HuggingFace Discussions",
    description:
      "List community discussions for a Hugging Face model. Returns title, status, author, comment count, and discussion number.",
    parameters: Type.Object({
      model: Type.String({
        description: "Model ID (e.g. 'unsloth/Qwen3.5-9B-GGUF')",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Number of discussions (1-50, default 10)",
          minimum: 1,
          maximum: 50,
        }),
      ),
      status: Type.Optional(Type.String({ enum: ["all", "open", "closed"] })),
      includePullRequests: Type.Optional(
        Type.Boolean({
          description: "Include pull requests in results (default true)",
        }),
      ),
      createdWithinDays: Type.Optional(
        Type.Number({
          description: "Only include discussions created within N days",
          minimum: 1,
          maximum: 3650,
        }),
      ),
      minComments: Type.Optional(
        Type.Number({
          description: "Only include discussions with at least N comments",
          minimum: 0,
          maximum: 100000,
        }),
      ),
      minReactions: Type.Optional(
        Type.Number({
          description: "Only include discussions with at least N reactions",
          minimum: 0,
          maximum: 100000,
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      const modelId = params.model;
      const limit = params.limit ?? 10;
      const status = (params.status ?? "all") as "all" | "open" | "closed";
      const includePullRequests = params.includePullRequests ?? true;
      const apiLimit = Math.min(100, Math.max(limit * 3, limit));

      const result = await hfFetch<DiscussionList>(
        `${HF_API}/models/${modelId}/discussions?limit=${apiLimit}`,
        signal,
      );

      const filtered = result.discussions
        .filter((d) => includePullRequests || !d.isPullRequest)
        .filter((d) => {
          if (status === "all") return true;
          if (status === "closed") return d.status === "closed";
          return d.status !== "closed";
        })
        .filter((d) => {
          if (params.createdWithinDays === undefined) return true;
          return isWithinLastDays(d.createdAt, params.createdWithinDays);
        })
        .filter((d) => {
          if (params.minComments === undefined) return true;
          return d.numComments >= params.minComments;
        })
        .filter((d) => {
          if (params.minReactions === undefined) return true;
          return totalReactions(d.topReactions) >= params.minReactions;
        })
        .slice(0, limit);

      if (!filtered.length) {
        return textResult(
          `No discussions found for ${modelId} with current filters.`,
          {
            model: modelId,
            filters: params,
          },
        );
      }

      const rows = filtered.map((d) => {
        const type = d.isPullRequest ? "PR" : "Disc";
        const flags = [
          d.pinned ? "pin" : "",
          d.repoOwner?.isParticipating ? "●" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const url = `${HF_BASE}/models/${modelId}/discussions/${d.num}`;
        return {
          "#": d.num,
          Type: type,
          Status:
            d.status === "closed"
              ? `${stateDot("off")} closed`
              : `${stateDot("on")} open`,
          Title: d.title,
          Author: fmtAuthor(d.author),
          Comments: d.numComments,
          Reactions:
            totalReactions(d.topReactions) > 0
              ? `+${totalReactions(d.topReactions)}`
              : "-",
          "Reaction count": totalReactions(d.topReactions),
          Age: formatIsoAge(d.createdAt),
          Flags: flags || "-",
          url,
        };
      });

      const discCols: Column[] = [
        { key: "#", align: "right", minWidth: 4 },
        { key: "status", minWidth: 6 },
        { key: "󰍻", align: "right", minWidth: 4 },
        { key: "age", align: "right", minWidth: 5 },
        {
          key: "title",
          format: (_v: unknown, row: Record<string, unknown>) => {
            const r = row as Record<string, string>;
            const meta = [r.author, r.type, r.flags !== "-" ? r.flags : ""]
              .filter(Boolean)
              .join(" · ");
            const lines: string[] = [];
            if (meta) lines.push(meta);
            if (r.url) lines.push(r.url);
            return meta || r.url
              ? `${r._title}\n${lines.join("\n")}`
              : r._title;
          },
        },
      ];
      const discRows = rows.map((r) => ({
        "#": String(r["#"]),
        status: r.Status,
        "󰍻": String(r.Comments),
        age: r.Age,
        title: r.Title,
        author: r.Author,
        type: r.Type,
        flags: r.Flags,
        url: r.url,
        _title: r.Title,
      }));

      const header = dotJoin(
        countLabel(result.count, "discussion"),
        `${result.numClosedDiscussions} closed`,
        `showing ${filtered.length}`,
      );
      return textResult([header, "", table(discCols, discRows)].join("\n"), {
        model: modelId,
        count: result.count,
        returned: filtered.length,
        filters: {
          status,
          includePullRequests,
          createdWithinDays: params.createdWithinDays,
          minComments: params.minComments,
          minReactions: params.minReactions,
          limit,
        },
      });
    },
  });
}
