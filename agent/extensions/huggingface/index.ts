/**
 * Hugging Face extension - search models, inspect quant files, read discussions.
 *
 * Tools:
 *   search-huggingface-models      - search models by query, filter by tags
 *   get-huggingface-model          - full model details + files + README
 *   list-huggingface-discussions   - list community discussions for a model
 *   get-huggingface-discussion     - read a specific discussion with comments
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { textResult } from "../../shared/tool-utils";
import { throttledFetch } from "../../shared/throttle";
import {
  dotJoin,
  countLabel,
  threadSeparator,
  table,
  detail,
  stateDot,
} from "../renderers";
import type { Column } from "../renderers";

const HF_API = "https://huggingface.co/api";
const HF_BASE = "https://huggingface.co";
const HF_UA = { "User-Agent": "pi-huggingface-tool/1.0" };

/** Render a Record<string,string> as detail fields, or an array of objects as a table. */
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

// --- API response types (mirrors actual API shape) ---

interface Author {
  name: string;
  fullname?: string;
  type?: string;
  isPro?: boolean;
  isHf?: boolean;
  isOrgMember?: boolean;
  followerCount?: number;
}

interface Reaction {
  reaction: string;
  users: string[];
  count: number;
}

interface Sibling {
  rfilename: string;
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

interface BenchmarkResult {
  task: { type: string; name?: string };
  dataset: { name: string; type?: string };
  metrics: { type: string; name?: string; value: number }[];
  source?: { name?: string; url?: string };
}

interface ModelIndex {
  name?: string;
  results: BenchmarkResult[];
}

interface WidgetEntry {
  text?: string;
  messages?: { role: string; content: string }[];
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
  siblings: Sibling[];
}

interface ModelDetail extends ModelSummary {
  disabled?: boolean;
  cardData?: CardData;
  config?: {
    model_type?: string;
    architectures?: string[];
  };
  transformersInfo?: {
    auto_model?: string;
    pipeline_tag?: string;
    processor?: string;
  };
  "model-index"?: ModelIndex[];
  widgetData?: WidgetEntry[];
  usedStorage?: number;
  spaces?: string[];
  inference?: string;
}

interface TreeEntry {
  type: string;
  path: string;
  size: number;
  oid?: string;
  lfs?: { oid: string; size: number; pointerSize: number };
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

interface DiscussionEvent {
  id: string;
  type: string;
  author: Author | null;
  createdAt: string;
  data?: {
    edited?: boolean;
    hidden?: boolean;
    latest?: { raw?: string };
    status?: string;
    subject?: string;
    oid?: string;
    reactions?: Reaction[];
    numEdits?: number;
  };
}

interface DiscussionDetail {
  num: number;
  title: string;
  status: string;
  isPullRequest: boolean;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  author: Author;
  org?: { name: string; fullname?: string; type: string; plan?: string };
  events: DiscussionEvent[];
}

// --- Helpers ---

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

function fmtSize(bytes: number): string {
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(0)}MB`;
  return `${(bytes / 1024).toFixed(0)}KB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtAge(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function entrySize(e: TreeEntry): number {
  return e.lfs?.size ?? e.size;
}

function extractLicense(tags: string[], cardData?: CardData): string | null {
  if (cardData?.license) return cardData.license;
  const tag = tags.find((t) => t.startsWith("license:"));
  return tag ? tag.replace("license:", "") : null;
}

function extractBaseModel(tags: string[], cardData?: CardData): string | null {
  if (cardData?.base_model) {
    return Array.isArray(cardData.base_model)
      ? cardData.base_model.join(", ")
      : cardData.base_model;
  }
  for (const prefix of [
    "base_model:quantized:",
    "base_model:finetune:",
    "base_model:",
  ]) {
    const tag = tags.find((t) => t.startsWith(prefix));
    if (tag) return tag.replace(prefix, "");
  }
  return null;
}

function extractArxiv(tags: string[]): string[] {
  return tags
    .filter((t) => t.startsWith("arxiv:"))
    .map((t) => t.replace("arxiv:", ""));
}

function userTags(tags: string[]): string[] {
  return tags.filter(
    (t) =>
      !t.startsWith("base_model:") &&
      !t.startsWith("license:") &&
      !t.startsWith("arxiv:") &&
      !t.startsWith("deploy:") &&
      !t.startsWith("dataset:") &&
      t !== "region:us" &&
      t !== "endpoints_compatible",
  );
}

function parseCsv(input?: string): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function hasAnyDigit(value: string): boolean {
  for (const char of value) {
    if (char >= "0" && char <= "9") return true;
  }
  return false;
}

function guessQuantFormat(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1);
  const base = file.endsWith(".gguf") ? file.slice(0, -5) : file;
  const chunks = base
    .split("-")
    .flatMap((chunk) => chunk.split("."))
    .map((chunk) => chunk.toUpperCase());

  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    const c = chunks[i];
    if (c.length === 0) continue;

    if ((c.startsWith("IQ") || c.startsWith("Q")) && hasAnyDigit(c)) return c;
    if (c === "BF16" || c === "F16" || c === "F32") return c;
    if (c.startsWith("MXFP")) return c;
    if (c.startsWith("UD") && hasAnyDigit(c)) return c;
  }

  return "UNKNOWN";
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

function fmtReactions(
  reactions: Reaction[] | { reaction: string; count: number }[],
): string {
  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  return total > 0 ? `+${total}` : "";
}

async function fetchReadme(
  modelId: string,
  signal?: AbortSignal,
  maxLen = 4000,
): Promise<string | null> {
  const revisions = ["main", "master"];
  for (const revision of revisions) {
    try {
      const res = await throttledFetch(
        `${HF_BASE}/${modelId}/raw/${revision}/README.md`,
        {
          signal,
          headers: HF_UA,
        },
      );
      if (!res.ok) continue;
      let text = await res.text();
      if (text.startsWith("---")) {
        const end = text.indexOf("---", 3);
        if (end !== -1) text = text.slice(end + 3).trimStart();
      }
      if (text.length > maxLen)
        text = text.slice(0, maxLen) + "\n\n[... truncated]";
      return text;
    } catch {
      // Try next revision.
    }
  }
  return null;
}

async function fetchModelTree(
  modelId: string,
  signal?: AbortSignal,
): Promise<TreeEntry[]> {
  const revisions = ["main", "master"];
  let lastError: Error | null = null;

  for (const revision of revisions) {
    try {
      return await hfFetch<TreeEntry[]>(
        `${HF_API}/models/${modelId}/tree/${revision}`,
        signal,
      );
    } catch (error) {
      if (error instanceof Error) lastError = error;
    }
  }

  throw lastError ?? new Error("Failed to fetch model tree");
}

// --- Extension ---

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
        StringEnum(["downloads", "likes", "created"] as const),
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
        const tags = userTags(m.tags)
          .filter((t) => t !== m.pipeline_tag && t !== m.library_name)
          .slice(0, 3)
          .join(", ");
        return {
          Model: m.id,
          "󰇚": fmtNum(m.downloads),
          "󰋑": m.likes,
          License: extractLicense(m.tags, m.cardData) ?? "",
          Pipeline: m.pipeline_tag ?? "",
          Tags: tags,
          Updated: m.lastModified ? fmtAge(m.lastModified) : "",
        };
      });

      const searchCols: Column[] = [
        { key: "󰇚", align: "right", minWidth: 7 },
        { key: "󰋑", align: "right", minWidth: 4 },
        {
          key: "model",
          format: (_v, row) => {
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
            return lines.join("\n");
          },
        },
      ];
      const tableRows = rows.map((r) => ({
        "󰇚": r["󰇚"],
        "󰋑": String(r["󰋑"]),
        model: r.Model,
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

  // ── get-huggingface-model ──────────────────────────────────────────

  pi.registerTool({
    name: "get-huggingface-model",
    label: "HuggingFace Model",
    description:
      "Get details of a Hugging Face model. For GGUF repos, lists all quant files with sizes. Returns tags, downloads, likes, license, and file listing.",
    parameters: Type.Object({
      model: Type.String({
        description:
          "Model ID in owner/name format (e.g. 'unsloth/Qwen3-Coder-Next-GGUF')",
      }),
    }),

    async execute(_toolCallId, params, signal) {
      const modelId = params.model;

      const [model, tree, readme] = await Promise.all([
        hfFetch<ModelDetail>(`${HF_API}/models/${modelId}`, signal),
        fetchModelTree(modelId, signal),
        fetchReadme(modelId, signal),
      ]);

      const isGguf = model.tags.includes("gguf");
      const out: string[] = [];

      // ── Header ──
      // model.id already known from input
      out.push(`${HF_BASE}/${model.id}`);
      out.push("");

      // ── Metadata as key-value record ──
      const meta: Record<string, string> = {};
      meta.Downloads = fmtNum(model.downloads);
      meta.Likes = String(model.likes);
      if (model.pipeline_tag) meta.Pipeline = model.pipeline_tag;
      if (model.library_name) meta.Library = model.library_name;
      if (model.author) meta.Author = model.author;

      const license = extractLicense(model.tags, model.cardData);
      if (license) {
        const link = model.cardData?.license_link;
        meta.License = license + (link ? ` (${link})` : "");
      }

      const baseModel = extractBaseModel(model.tags, model.cardData);
      if (baseModel) meta["Base model"] = baseModel;

      if (model.config?.architectures?.length)
        meta.Architecture = model.config.architectures.join(", ");
      if (model.config?.model_type)
        meta["Model type"] = model.config.model_type;

      if (model.transformersInfo) {
        const ti = model.transformersInfo;
        const parts: string[] = [];
        if (ti.auto_model) parts.push(`auto_model=${ti.auto_model}`);
        if (ti.processor) parts.push(`processor=${ti.processor}`);
        if (parts.length) meta.Transformers = parts.join(", ");
      }

      if (model.cardData?.language?.length)
        meta.Languages = model.cardData.language.join(", ");
      if (model.cardData?.datasets?.length)
        meta.Datasets = model.cardData.datasets.join(", ");
      if (model.usedStorage) meta["Total storage"] = fmtSize(model.usedStorage);

      if (model.gated)
        meta.Gated = typeof model.gated === "string" ? model.gated : "yes";
      if (model.private) meta.Private = "yes";
      if (model.disabled) meta.Disabled = "yes";
      if (model.inference) meta.Inference = model.inference;

      meta.Created = fmtDate(model.createdAt);
      if (model.lastModified)
        meta.Updated = `${fmtDate(model.lastModified)} (${fmtAge(model.lastModified)})`;
      meta.SHA = model.sha;

      const tags = userTags(model.tags);
      if (tags.length > 0) meta.Tags = tags.join(", ");

      const arxivIds = extractArxiv(model.tags);
      if (arxivIds.length > 0)
        meta.Papers = arxivIds
          .map((id) => `https://arxiv.org/abs/${id}`)
          .join(", ");

      out.push(renderData(meta));

      // ── Spaces ──
      if (model.spaces?.length) {
        out.push("");
        out.push(`## Spaces (${model.spaces.length})`);
        const shown = model.spaces.slice(0, 10);
        out.push(
          renderData(
            shown.map((s) => ({ Space: s, URL: `${HF_BASE}/spaces/${s}` })),
          ),
        );
        if (model.spaces.length > 10)
          out.push(`... and ${model.spaces.length - 10} more`);
      }

      // ── Widget examples ──
      if (model.widgetData?.length) {
        out.push("");
        out.push("## Widget examples");
        const examples: string[] = [];
        for (const w of model.widgetData.slice(0, 4)) {
          if (w.text) examples.push(w.text);
          else if (w.messages?.length) {
            const msg = w.messages.find((m) => m.role === "user");
            if (msg) examples.push(msg.content);
          }
        }
        out.push(renderData(examples.map((e) => ({ Prompt: e }))));
      }

      // ── Benchmarks ──
      if (model["model-index"]?.length) {
        const results = model["model-index"].flatMap((mi) => mi.results ?? []);
        if (results.length > 0) {
          out.push("");
          out.push("## Benchmarks");
          const rows = results.map((r) => {
            const m = r.metrics[0];
            return {
              Dataset: r.dataset.name,
              Metric: m?.name ?? m?.type ?? "score",
              Value:
                typeof m?.value === "number"
                  ? m.value.toFixed(2)
                  : String(m?.value ?? "?"),
            };
          });
          out.push(renderData(rows));
          const src = results[0]?.source;
          if (src?.name)
            out.push(`Source: ${src.name}${src.url ? ` (${src.url})` : ""}`);
        }
      }

      // ── Files ──
      out.push("");

      if (isGguf) {
        const ggufFiles = tree
          .filter((f) => f.type === "file" && f.path.endsWith(".gguf"))
          .sort((a, b) => entrySize(a) - entrySize(b));
        const ggufDirs = tree
          .filter((f) => f.type === "directory")
          .map((d) => d.path);

        if (ggufFiles.length > 0) {
          const quantRows = ggufFiles.map((f) => ({
            Size: fmtSize(entrySize(f)),
            Format: guessQuantFormat(f.path),
            File: f.path,
          }));
          out.push(`## Quant files (${ggufFiles.length})`);
          out.push(renderData(quantRows));

          const formatStats = new Map<
            string,
            {
              count: number;
              totalSize: number;
              minSize: number;
              maxSize: number;
            }
          >();
          for (const file of ggufFiles) {
            const format = guessQuantFormat(file.path);
            const size = entrySize(file);
            const current = formatStats.get(format);
            if (!current) {
              formatStats.set(format, {
                count: 1,
                totalSize: size,
                minSize: size,
                maxSize: size,
              });
            } else {
              current.count += 1;
              current.totalSize += size;
              current.minSize = Math.min(current.minSize, size);
              current.maxSize = Math.max(current.maxSize, size);
            }
          }

          const summaryRows = [...formatStats.entries()]
            .map(([format, stats]) => ({
              Format: format,
              Files: stats.count,
              "Total size": fmtSize(stats.totalSize),
              "Size range":
                stats.minSize === stats.maxSize
                  ? fmtSize(stats.minSize)
                  : `${fmtSize(stats.minSize)} – ${fmtSize(stats.maxSize)}`,
            }))
            .sort((a, b) => a.Format.localeCompare(b.Format));

          out.push("");
          out.push("## Quant format summary");
          out.push(renderData(summaryRows));

          const notableFormats = summaryRows
            .map((row) => row.Format)
            .filter(
              (format) =>
                format.startsWith("UD") ||
                format.startsWith("IQ1") ||
                format.startsWith("IQ2") ||
                format.startsWith("MXFP") ||
                format === "BF16" ||
                format === "F16",
            );
          if (notableFormats.length > 0) {
            out.push("");
            out.push(`Notable formats: ${notableFormats.join(", ")}`);
          }
        }
        if (ggufDirs.length > 0) {
          out.push("");
          out.push(`## Multi-part directories: ${ggufDirs.join(", ")}`);
        }

        const otherFiles = tree
          .filter(
            (f) =>
              f.type === "file" &&
              !f.path.endsWith(".gguf") &&
              !f.path.startsWith(".") &&
              f.path !== "README.md",
          )
          .sort((a, b) => a.path.localeCompare(b.path));
        if (otherFiles.length > 0) {
          out.push("");
          out.push("## Other files");
          out.push(
            renderData(
              otherFiles.map((f) => ({
                File: f.path,
                Size: fmtSize(entrySize(f)),
              })),
            ),
          );
        }
      } else {
        const weightExts = [".safetensors", ".bin", ".pt", ".onnx"];
        const isWeight = (f: TreeEntry) =>
          weightExts.some((ext) => f.path.endsWith(ext));
        const weights = tree
          .filter((f) => f.type === "file" && isWeight(f))
          .sort((a, b) => entrySize(a) - entrySize(b));
        const others = tree
          .filter(
            (f) =>
              f.type === "file" &&
              !isWeight(f) &&
              !f.path.startsWith(".") &&
              f.path !== "README.md",
          )
          .sort((a, b) => a.path.localeCompare(b.path));
        const dirs = tree
          .filter((f) => f.type === "directory")
          .map((d) => d.path);

        if (weights.length > 0) {
          const total = weights.reduce((s, f) => s + entrySize(f), 0);
          out.push(
            `## Model weights (${weights.length} files, ${fmtSize(total)} total)`,
          );
          if (weights.length <= 12) {
            out.push(
              renderData(
                weights.map((f) => ({
                  Size: fmtSize(entrySize(f)),
                  File: f.path,
                })),
              ),
            );
          } else {
            const rows = [
              { Size: fmtSize(entrySize(weights[0])), File: weights[0].path },
              { Size: "...", File: `(${weights.length - 2} more shards)` },
              {
                Size: fmtSize(entrySize(weights[weights.length - 1])),
                File: weights[weights.length - 1].path,
              },
            ];
            out.push(renderData(rows));
          }
        }

        if (others.length > 0) {
          out.push("");
          out.push(`## Other files (${others.length})`);
          out.push(
            renderData(
              others.map((f) => ({
                File: f.path,
                Size: fmtSize(entrySize(f)),
              })),
            ),
          );
        }

        if (dirs.length > 0) {
          out.push("");
          out.push(`## Directories: ${dirs.join(", ")}`);
        }
      }

      // ── README (model card) ──
      if (readme) {
        out.push("");
        out.push("## Model Card (README.md)");
        out.push(readme);
      }

      return textResult(out.join("\n"), {
        model: modelId,
        downloads: model.downloads,
        likes: model.likes,
        isGguf,
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
      status: Type.Optional(StringEnum(["all", "open", "closed"] as const)),
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
      const status = params.status ?? "all";
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
          Reactions: fmtReactions(d.topReactions) || "-",
          "Reaction count": totalReactions(d.topReactions),
          Age: fmtAge(d.createdAt),
          Flags: flags || "-",
        };
      });

      const discCols: Column[] = [
        { key: "#", align: "right", minWidth: 4 },
        { key: "status", minWidth: 6 },
        { key: "󰍻", align: "right", minWidth: 4 },
        { key: "age", align: "right", minWidth: 5 },
        {
          key: "title",
          format: (_v, row) => {
            const r = row as Record<string, string>;
            const meta = [r.author, r.type, r.flags !== "-" ? r.flags : ""]
              .filter(Boolean)
              .join(" · ");
            return meta ? `${r._title}\n${meta}` : r._title;
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

  // ── get-huggingface-discussion ─────────────────────────────────────

  pi.registerTool({
    name: "get-huggingface-discussion",
    label: "HuggingFace Discussion",
    description:
      "Read a specific Hugging Face model discussion with all comments. Use discussion number from list-huggingface-discussions.",
    parameters: Type.Object({
      model: Type.String({
        description: "Model ID (e.g. 'unsloth/Qwen3.5-9B-GGUF')",
      }),
      discussion: Type.Number({ description: "Discussion number (e.g. 6)" }),
      maxEvents: Type.Optional(
        Type.Number({
          description: "Maximum number of events to render (default: all)",
          minimum: 1,
          maximum: 500,
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      const modelId = params.model;
      const num = params.discussion;

      const d = await hfFetch<DiscussionDetail>(
        `${HF_API}/models/${modelId}/discussions/${num}`,
        signal,
      );

      const out: string[] = [];

      // ── Header as record ──
      const type = d.isPullRequest ? "PR" : "Discussion";
      const headerMeta: Record<string, string> = {
        type: type,
        "#": String(d.num),
        title: d.title,
        status:
          d.status === "closed"
            ? `${stateDot("off")} closed`
            : `${stateDot("on")} open`,
        url: `${HF_BASE}/${modelId}/discussions/${num}`,
        "opened by": fmtAuthor(d.author),
        date: fmtDate(d.createdAt),
      };
      if (d.pinned) headerMeta.pinned = "yes";
      if (d.locked) headerMeta.locked = "yes";
      if (d.org) {
        const orgParts = [d.org.name];
        if (d.org.fullname && d.org.fullname !== d.org.name)
          orgParts.push(`(${d.org.fullname})`);
        if (d.org.plan) orgParts.push(`[${d.org.plan}]`);
        headerMeta["repo org"] = orgParts.join(" ");
      }
      const headerFields = Object.entries(headerMeta).map(([k, v]) => ({
        label: k,
        value: v,
      }));
      // modelId/discussion num already known from input
      out.push("");
      out.push(detail(headerFields));

      const events =
        params.maxEvents !== undefined
          ? d.events.slice(0, params.maxEvents)
          : d.events;

      // ── Thread ──
      const threadSections = events.map((e) => {
        const author = e.author ? fmtAuthor(e.author) : "system";
        const date = fmtDate(e.createdAt);

        switch (e.type) {
          case "comment": {
            const body = e.data?.latest?.raw?.trim() ?? "(empty)";
            const flags = [
              e.data?.edited ? "edited" : "",
              e.data?.hidden ? "hidden" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const reactions = fmtReactions(e.data?.reactions ?? []);
            const footer = [flags, reactions].filter(Boolean).join("  ");
            const content = footer ? `${body}\n\n${footer}` : body;
            return [threadSeparator(author, date), content].join("\n");
          }
          case "status-change":
            return [
              threadSeparator(
                author,
                date,
                `status → ${e.data?.status ?? "unknown"}`,
              ),
            ].join("\n");
          case "commit": {
            const ref =
              e.data?.subject ?? e.data?.oid?.slice(0, 8) ?? "unknown";
            const oid = e.data?.oid ? ` (${e.data.oid.slice(0, 12)})` : "";
            return [threadSeparator("commit", date), `${ref}${oid}`].join("\n");
          }
          default:
            return [threadSeparator(e.type, date), author].join("\n");
        }
      });

      out.push("");
      out.push(...threadSections);

      return textResult(out.join("\n"), {
        model: modelId,
        discussion: num,
        title: d.title,
        status: d.status,
        eventsRendered: events.length,
        totalEvents: d.events.length,
      });
    },
  });
}
