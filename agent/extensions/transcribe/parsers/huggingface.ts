import {
  createRetryFetch,
  createRetryFetchText,
  defineParser,
} from "../lib/parser-utils";
import {
  formatIsoAge,
  formatDownloadsShort,
  filterUserTags,
} from "../lib/formatters";
import { fmtAuthorBase } from "../../../shared/rendering/header";
interface HFRepo {
  kind: "model" | "dataset" | "space";
  owner: string;
  name: string;
}
type HFPathType = "repo" | "file" | "tree" | "discussions" | "discussion";
interface HFPath extends HFRepo {
  type: HFPathType;
  revision?: string;
  path?: string;
  number?: number;
}
const BASE = "https://huggingface.co";
const API = `${BASE}/api`;
function parseHFUrl(url: string): HFPath | null {
  const match = url.match(/^https?:\/\/huggingface\.co\/(.+)$/);
  if (!match) return null;
  const rest = match[1].replace(/\/+$/, "");
  if (!rest) return null;
  const explicit = tryParseExplicitPath(rest);
  if (explicit) return explicit;

  return tryParseBarePath(rest);
}
function tryParseExplicitPath(rest: string): HFPath | null {
  const match = rest.match(
    /^(models|datasets|spaces)\/([^/]+)\/([^/]+)(?:\/(.+))?$/,
  );
  if (!match) return null;
  const [, kind, owner, name, subpath] = match;
  return parseSubpath(kind as HFRepo["kind"], owner, name, subpath ?? null);
}
function tryParseBarePath(rest: string): HFPath | null {
  const match = rest.match(/^([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (!match) return null;
  const [, owner, name, subpath] = match;
  return parseSubpath("model", owner, name, subpath ?? null);
}
function parseSubpath(
  kind: HFRepo["kind"],
  owner: string,
  name: string,
  subpath: string | null,
): HFPath {
  const base: HFPath = { kind, owner, name, type: "repo" };
  if (!subpath) return base;
  const parts = subpath.split("/");
  const first = parts[0].toLowerCase();
  if (first === "blob") return tryParseBlobPath(base, parts);
  if (first === "tree") return parseTreePath(base, parts);
  if (first === "discussions") return parseDiscussionPath(base, parts);
  return base;
}
function tryParseBlobPath(base: HFPath, parts: string[]): HFPath {
  if (parts.length < 3) return base;
  return {
    ...base,
    type: "file",
    revision: parts[1],
    path: parts.slice(2).join("/"),
  };
}
function parseTreePath(base: HFPath, parts: string[]): HFPath {
  const revision = parts.length > 1 ? parts[1] : undefined;
  const filePath = parts.length > 2 ? parts.slice(2).join("/") : undefined;
  return { ...base, type: "tree", revision, path: filePath };
}
function parseDiscussionPath(base: HFPath, parts: string[]): HFPath {
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
    return { ...base, type: "discussion", number: parseInt(parts[1], 10) };
  }
  return { ...base, type: "discussions" };
}

const hfFetchOpts = { apiName: "HuggingFace" };

function fetchJSON<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  return createRetryFetch(hfFetchOpts)(`${API}/${endpoint}`, signal);
}

function fetchRaw(
  repo: HFRepo,
  revision: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${BASE}/${repo.owner}/${repo.name}/resolve/${revision}/${filePath}`;
  return createRetryFetchText(hfFetchOpts)(url, signal);
}
interface HFTreeEntry {
  type: "file" | "directory";
  path: string;
  size?: number;
  lfs?: Record<string, unknown>;
}
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${i > 0 ? bytes.toFixed(1) : bytes} ${units[i]}`;
}
function tagToBullet(tag: string): string {
  const colon = tag.indexOf(":");
  if (colon > 0) return `${tag.slice(0, colon)}: ${tag.slice(colon + 1)}`;
  return tag;
}
function repoApiPath(parsed: HFPath): string {
  return `${parsed.kind}s/${parsed.owner}/${parsed.name}`;
}

async function fetchReadme(
  parsed: HFRepo,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const tree = await fetchJSON<HFTreeEntry[]>(
      `${repoApiPath(parsed as HFPath)}/tree/main`,
      signal,
    );
    const readmeEntry = tree.find((e) => e.path === "README.md");
    if (readmeEntry) {
      return await fetchRaw(parsed, "main", "README.md", signal);
    }
  } catch {}
  return "";
}
function renderTags(
  parts: string[],
  tags: string[],
  filterFn?: (tag: string) => boolean,
  limit?: number,
): void {
  const filtered = filterFn ? tags.filter(filterFn) : tags;
  const sliced = limit ? filtered.slice(0, limit) : filtered;
  if (sliced.length) {
    parts.push("");
    parts.push("**Tags:**");
    for (const tag of sliced) {
      parts.push(`- ${tagToBullet(tag)}`);
    }
  }
}
function appendReadme(parts: string[], readme: string): void {
  if (readme) {
    parts.push("");
    parts.push(readme);
  }
}

interface RepoBodyOptions {
  tags?: string[];
  downloads?: number;
  likes?: number;
  lastModified?: string;
  gated?: boolean | string;
  tagFilter?: (tag: string) => boolean;
  tagLimit?: number;
  extraDescription?: string;
}

function renderLicenseAndBase(
  parts: string[],
  tags: string[] | undefined,
  cardData?: Record<string, unknown>,
): void {
  if (!tags) return;
  const license = extractLicense(tags, cardData);
  const baseModel = extractBaseModel(tags, cardData);
  if (license || baseModel) {
    parts.push("");
    parts.push(
      [
        license ? `**License:** ${license}` : "",
        baseModel ? `**Base model:** ${baseModel}` : "",
      ]
        .filter(Boolean)
        .join(" • "),
    );
  }
}

function renderRepoMetadata(parts: string[], opts: RepoBodyOptions): void {
  const downloadsShort =
    opts.downloads !== undefined ? formatDownloadsShort(opts.downloads) : null;
  const lastModifiedAge = opts.lastModified
    ? formatIsoAge(opts.lastModified)
    : null;
  if (!downloadsShort && !lastModifiedAge) return;
  parts.push("");
  const metaParts: string[] = [];
  if (downloadsShort) metaParts.push(`downloads: ${downloadsShort}`);
  if (lastModifiedAge) metaParts.push(`updated: ${lastModifiedAge}`);
  parts.push(metaParts.join(" • "));
}

async function renderRepoBody(
  parts: string[],
  opts: RepoBodyOptions,
  parsed: HFPath,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (opts.tags?.length) {
    renderTags(parts, opts.tags, opts.tagFilter, opts.tagLimit);
  }
  renderLicenseAndBase(parts, opts.tags);
  renderRepoMetadata(parts, opts);
  const readme = await fetchReadme(parsed, signal);
  if (readme) {
    appendReadme(parts, readme);
  } else if (opts.extraDescription) {
    parts.push("");
    parts.push(opts.extraDescription);
  }
}
function addKindSpecificHeader(
  parts: string[],
  kind: HFRepo["kind"],
  info: Record<string, unknown>,
): void {
  if (kind === "model" && typeof info.pipeline_tag === "string") {
    parts.push(`**Pipeline:** ${info.pipeline_tag}`);
  } else if (kind === "space" && typeof info.sdk === "string") {
    parts.push(`**SDK:** ${info.sdk}`);
  }
}
function makeTagFilter(
  kind: HFRepo["kind"],
): ((t: string) => boolean) | undefined {
  if (kind === "model") {
    return (t) => !t.startsWith("region:") && t !== "safetensors";
  }
  if (kind === "dataset") {
    return (t) => !t.startsWith("region:");
  }
  return undefined;
}
function extractDatasetDescription(
  info: Record<string, unknown>,
): string | undefined {
  const raw = info.description;
  if (typeof raw !== "string" || !raw) return undefined;
  return raw.replace(/\t+/g, "").replace(/>\s*/g, ">").trim();
}

function extractRepoTags(info: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(info.tags)) return undefined;
  return info.tags.filter((t): t is string => typeof t === "string");
}

function safeNumber(val: unknown, fallback?: number): number | undefined {
  return typeof val === "number" ? val : fallback;
}

function safeString(val: unknown, fallback?: string): string | undefined {
  return typeof val === "string" ? val : fallback;
}

function buildRepoBodyOptions(
  info: Record<string, unknown>,
  parsed: HFPath,
): RepoBodyOptions {
  const datasetDesc =
    parsed.kind === "dataset" ? extractDatasetDescription(info) : undefined;
  return {
    tags: extractRepoTags(info),
    downloads: safeNumber(info.downloads),
    likes: safeNumber(info.likes),
    lastModified: safeString(info.lastModified),
    gated:
      typeof info.gated === "boolean" || typeof info.gated === "string"
        ? info.gated
        : undefined,
    tagFilter: makeTagFilter(parsed.kind),
    tagLimit: parsed.kind === "dataset" ? 20 : undefined,
    extraDescription: datasetDesc,
  };
}

function formatSize(bytes: number): string {
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(0)}MB`;
  return `${(bytes / 1024).toFixed(0)}KB`;
}

function extractLicense(
  tags: string[],
  cardData?: Record<string, unknown>,
): string | null {
  if (cardData?.license) return String(cardData.license);
  const tag = tags.find((t) => t.startsWith("license:"));
  return tag ? tag.replace("license:", "") : null;
}

function extractBaseModel(
  tags: string[],
  cardData?: Record<string, unknown>,
): string | null {
  if (cardData?.base_model) {
    return Array.isArray(cardData.base_model)
      ? (cardData.base_model as string[]).join(", ")
      : String(cardData.base_model);
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
    if (isQuantFormat(c)) return c;
  }
  return "UNKNOWN";
}

function hasAnyDigit(value: string): boolean {
  for (const char of value) {
    if (char >= "0" && char <= "9") return true;
  }
  return false;
}

function isQuantFormat(c: string): boolean {
  return isQFormat(c) || isFloatFormat(c) || isMxfpFormat(c) || isUdFormat(c);
}

function isQFormat(c: string): boolean {
  return (c.startsWith("IQ") || c.startsWith("Q")) && hasAnyDigit(c);
}

function isFloatFormat(c: string): boolean {
  return c === "BF16" || c === "F16" || c === "F32";
}

function isMxfpFormat(c: string): boolean {
  return c.startsWith("MXFP");
}

function isUdFormat(c: string): boolean {
  return c.startsWith("UD") && hasAnyDigit(c);
}

interface HFModelDetail extends Record<string, unknown> {
  id: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag?: string;
  library_name?: string;
  cardData?: Record<string, unknown>;
  config?: { model_type?: string; architectures?: string[] };
  transformersInfo?: { auto_model?: string; processor?: string };
  "model-index"?: Array<{
    name?: string;
    results: Array<{
      dataset: { name: string };
      metrics: Array<{ type: string; name?: string; value: number }>;
    }>;
  }>;
  widgetData?: Array<{
    text?: string;
    messages?: Array<{ role: string; content: string }>;
  }>;
  usedStorage?: number;
  spaces?: string[];
  gated?: boolean | string;
  private?: boolean;
  disabled?: boolean;
  inference?: string;
  createdAt: string;
  lastModified?: string;
  sha: string;
}

interface HFDiscussionEvent {
  id: string;
  type: string;
  author: {
    name: string;
    fullname?: string;
    type?: string;
    isPro?: boolean;
    isHf?: boolean;
  } | null;
  createdAt: string;
  data?: {
    edited?: boolean;
    hidden?: boolean;
    latest?: { raw?: string };
    status?: string;
    subject?: string;
    oid?: string;
    reactions?: Array<{ reaction: string; count: number }>;
  };
}

interface HFDiscussionDetail {
  num: number;
  title: string;
  status: string;
  isPullRequest: boolean;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  author: {
    name: string;
    fullname?: string;
    type?: string;
    isPro?: boolean;
    isHf?: boolean;
  };
  org?: { name: string; fullname?: string; type: string; plan?: string };
  events: HFDiscussionEvent[];
}

async function fetchModelDetail(
  modelId: string,
  signal?: AbortSignal,
): Promise<HFModelDetail> {
  return fetchJSON<HFModelDetail>(`models/${modelId}`, signal);
}

async function fetchModelTree(
  modelId: string,
  signal?: AbortSignal,
): Promise<HFTreeEntry[]> {
  const revisions = ["main", "master"];
  const [owner, name] = modelId.split("/");
  let lastError: Error | null = null;
  for (const revision of revisions) {
    try {
      return await fetchJSON<HFTreeEntry[]>(
        `${repoApiPath({ kind: "model" as const, owner, name, type: "repo" as const })}/tree/${revision}`,
        signal,
      );
    } catch (error) {
      if (error instanceof Error) lastError = error;
    }
  }
  throw lastError ?? new Error("Failed to fetch model tree");
}

function fmtAuthor(
  a: {
    name: string;
    fullname?: string;
    type?: string;
    isPro?: boolean;
    isHf?: boolean;
  } | null,
): string {
  if (!a) return "system";
  const parts = fmtAuthorBase(a);
  return parts.join(" ");
}

function fmtReactions(
  reactions: Array<{ reaction: string; count: number }>,
): string {
  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  return total > 0 ? `+${total}` : "";
}

function renderTransformersInfo(parts: string[], detail: HFModelDetail): void {
  const ti = detail.transformersInfo;
  if (!ti) return;
  const meta: string[] = [];
  if (ti.auto_model) meta.push(`auto_model=${ti.auto_model}`);
  if (ti.processor) meta.push(`processor=${ti.processor}`);
  if (meta.length) {
    parts.push(`**Transformers:** ${meta.join(", ")}`);
  }
}

function renderConfigInfo(parts: string[], detail: HFModelDetail): void {
  if (!detail.config?.architectures?.length && !detail.config?.model_type)
    return;
  parts.push("");
  parts.push("## Configuration");
  if (detail.config.architectures?.length) {
    parts.push(`**Architecture:** ${detail.config.architectures.join(", ")}`);
  }
  if (detail.config.model_type) {
    parts.push(`**Model type:** ${detail.config.model_type}`);
  }
  renderTransformersInfo(parts, detail);
}

function renderCardData(parts: string[], detail: HFModelDetail): void {
  const cardData = detail.cardData as Record<string, unknown> | undefined;
  if (!Array.isArray(detail.tags)) return;
  const cardTags = filterUserTags(detail.tags);
  renderLicenseAndBase(parts, detail.tags, cardData);
  if (cardTags.length > 0 && cardTags.length <= 10) {
    parts.push("");
    parts.push("**Tags:**");
    for (const tag of cardTags) {
      parts.push(`- ${tagToBullet(tag)}`);
    }
  }
}

function renderCardDataFields(
  parts: string[],
  cardData: Record<string, unknown> | undefined,
): void {
  if (!cardData) return;
  if (cardData.language) {
    parts.push("");
    parts.push(
      "**Languages:** " +
        (Array.isArray(cardData.language)
          ? (cardData.language as string[]).join(", ")
          : String(cardData.language)),
    );
  }
  if (cardData.datasets) {
    parts.push(
      "**Datasets:** " +
        (Array.isArray(cardData.datasets)
          ? (cardData.datasets as string[]).join(", ")
          : String(cardData.datasets)),
    );
  }
}

function renderStatusInfo(parts: string[], detail: HFModelDetail): void {
  const statusParts: string[] = [];
  if (detail.gated) {
    statusParts.push(
      `gated: ${typeof detail.gated === "string" ? detail.gated : "yes"}`,
    );
  }
  if (detail.private) statusParts.push("private: yes");
  if (detail.disabled) statusParts.push("disabled: yes");
  if (statusParts.length) {
    parts.push("");
    parts.push(statusParts.join(" • "));
  }
}

function extractWidgetExamples(detail: HFModelDetail): string[] {
  if (!Array.isArray(detail.widgetData)) return [];
  const examples: string[] = [];
  for (const w of detail.widgetData) {
    if (w.text) {
      examples.push(w.text);
    } else if (w.messages?.length) {
      const msg = w.messages.find((m) => m.role === "user");
      if (msg) examples.push(msg.content);
    }
  }
  return examples;
}

function renderWidgetExamples(parts: string[], detail: HFModelDetail): void {
  const examples = extractWidgetExamples(detail);
  if (examples.length === 0) return;
  parts.push("");
  parts.push("## Widget examples");
  for (const e of examples) {
    parts.push(`> ${e.split("\n")[0]}`);
  }
}

// fallow-ignore-next-line complexity
function formatBenchmarkResult(r: Record<string, unknown>): string {
  const rm = r as { dataset?: { name?: string }; metrics?: unknown[] };
  const m = rm.metrics?.[0] as
    | { type?: string; name?: string; value?: number }
    | undefined;
  const value =
    typeof m?.value === "number" ? m.value.toFixed(2) : String(m?.value ?? "?");
  return `- ${rm.dataset?.name || "?"}: ${m?.name || m?.type || "score"} = ${value}`;
}

function renderBenchmarks(parts: string[], detail: HFModelDetail): void {
  const modelIndex = detail["model-index"];
  if (!Array.isArray(modelIndex) || modelIndex.length === 0) return;
  const results = modelIndex.flatMap(
    (mi) =>
      ((mi as { results?: unknown[] }).results ?? []) as Record<
        string,
        unknown
      >[],
  );
  if (results.length === 0) return;
  parts.push("");
  parts.push("## Benchmarks");
  for (const r of results) {
    parts.push(formatBenchmarkResult(r));
  }
}

function renderSpaces(parts: string[], detail: HFModelDetail): void {
  if (!Array.isArray(detail.spaces) || detail.spaces.length === 0) return;
  parts.push("");
  parts.push(`## Spaces (${detail.spaces.length})`);
  for (const s of detail.spaces) {
    parts.push(`- [${s}](https://huggingface.co/spaces/${s})`);
  }
}

function renderFileListSection(
  parts: string[],
  parsed: HFPath,
  tree: HFTreeEntry[],
  isGguf: boolean,
): void {
  if (isGguf) {
    const ggufFiles = tree.filter(
      (f) => f.type === "file" && f.path.endsWith(".gguf"),
    );
    if (ggufFiles.length > 0) {
      parts.push("");
      parts.push(`## Quant files (${ggufFiles.length})`);
      ggufFiles.forEach((f) => {
        const size =
          (f.lfs as { size?: number } | undefined)?.size ?? f.size ?? 0;
        const format = guessQuantFormat(f.path);
        parts.push(
          `- ${format} — [${f.path}](${BASE}/${parsed.owner}/${parsed.name}/blob/main/${encodeURIComponent(f.path)}) (${formatSize(size)})`,
        );
      });
    }
  } else {
    const weightExts = [".safetensors", ".bin", ".pt", ".onnx"];
    const isWeight = (f: HFTreeEntry) =>
      weightExts.some((ext) => f.path.endsWith(ext));
    const weights = tree
      .filter((f) => f.type === "file" && isWeight(f))
      .sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
    if (weights.length > 0) {
      parts.push("");
      const totalSize = weights.reduce((s, f) => s + (f.size ?? 0), 0);
      parts.push(
        `## Model weights (${weights.length} files, ${formatSize(totalSize)} total)`,
      );
      for (const w of weights) {
        const size =
          (w.lfs as { size?: number } | undefined)?.size ?? w.size ?? 0;
        parts.push(
          `- [${w.path}](${BASE}/${parsed.owner}/${parsed.name}/blob/main/${encodeURIComponent(w.path)}) (${formatSize(size)})`,
        );
      }
    }
  }
}

async function handleRepo(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  const info = await fetchJSON<Record<string, unknown>>(
    repoApiPath(parsed),
    signal,
  );
  const title = safeString(info.id, "unknown")!;
  const parts: string[] = [`# ${title}`];
  addKindSpecificHeader(parts, parsed.kind, info);

  await renderRepoBody(
    parts,
    buildRepoBodyOptions(info, parsed),
    parsed,
    signal,
  );

  if (parsed.kind === "model") {
    const isGguf = Array.isArray(info.tags) && info.tags.includes("gguf");

    try {
      const detail = await fetchModelDetail(
        parsed.owner + "/" + parsed.name,
        signal,
      );

      renderConfigInfo(parts, detail);
      renderCardData(parts, detail);
      renderCardDataFields(
        parts,
        detail.cardData as Record<string, unknown> | undefined,
      );
      renderStatusInfo(parts, detail);
      renderWidgetExamples(parts, detail);
      renderBenchmarks(parts, detail);
      renderSpaces(parts, detail);

      try {
        const tree = await fetchModelTree(
          parsed.owner + "/" + parsed.name,
          signal,
        );
        renderFileListSection(parts, parsed, tree, isGguf);
      } catch {}
    } catch {}
  }

  return parts.join("\n");
}
async function handleFile(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  if (!parsed.path) throw new Error("Missing file path");
  const revision = parsed.revision ?? "main";
  let content: string;

  try {
    content = await fetchRaw(parsed, revision, parsed.path, signal);
  } catch {
    const info = await fetchJSON<Record<string, unknown>>(
      repoApiPath(parsed),
      signal,
    );
    const sha = typeof info.sha === "string" ? info.sha : "main";
    content = await fetchRaw(parsed, sha, parsed.path, signal);
  }

  return `# ${parsed.path}\n\n\`${parsed.owner}/${parsed.name}@${revision}\`\n\n${content}`;
}

async function handleTree(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  const revision = parsed.revision ?? "main";
  const tree = await fetchJSON<HFTreeEntry[]>(
    `${repoApiPath(parsed)}/tree/${revision}${parsed.path ? `/${parsed.path}` : ""}`,
    signal,
  );
  const heading = parsed.path
    ? `${parsed.owner}/${parsed.name} — ${parsed.path}`
    : `${parsed.owner}/${parsed.name}`;
  const parts: string[] = [`# ${heading}`, "", `\`revision: ${revision}\``];
  const dirs = tree.filter((e) => e.type === "directory");
  const files = tree.filter((e) => e.type === "file");

  if (dirs.length) {
    parts.push("", "## Directories", ...dirs.map((d) => `- \`${d.path}/\``));
  }

  if (files.length) {
    parts.push("", "## Files", ...renderFileList(files));
  }

  return parts.join("\n");
}
function renderFileList(files: HFTreeEntry[]): string[] {
  const lines: string[] = [];
  for (const f of files) {
    const size = f.size ? ` (${formatBytes(f.size)})` : "";
    const lfs = f.lfs ? " [LFS]" : "";
    lines.push(`- \`${f.path}\`${size}${lfs}`);
  }
  return lines;
}
function fmtOrgName(detail: {
  org?: { name: string; fullname?: string };
}): string | undefined {
  if (!detail.org) return undefined;
  const orgName =
    detail.org.fullname && detail.org.fullname !== detail.org.name
      ? `${detail.org.name} (${detail.org.fullname})`
      : detail.org.name;
  return `**Org:** ${orgName}`;
}

function renderEventComment(
  parts: string[],
  event: HFDiscussionEvent,
  author: string,
  date: string,
): void {
  const flags: string[] = [];
  if (event.data?.edited) flags.push("edited");
  if (event.data?.hidden) flags.push("hidden");
  const body = event.data?.latest?.raw?.trim() ?? "(empty)";
  const reactions = fmtReactions(event.data?.reactions ?? []);
  const footer = [flags.join(" "), reactions].filter(Boolean).join("  ");
  const content = footer ? `${body}\n\n${footer}` : body;
  parts.push(`${author} • ${date}`);
  parts.push(content);
}

function renderEventStatusChange(
  parts: string[],
  event: HFDiscussionEvent,
  author: string,
  date: string,
): void {
  const status = event.data?.status ?? "unknown";
  parts.push(`${author} • ${date}`);
  parts.push(`status → ${status}`);
}

function renderEventCommit(
  parts: string[],
  event: HFDiscussionEvent,
  date: string,
): void {
  const ref = event.data?.subject ?? event.data?.oid?.slice(0, 8) ?? "unknown";
  const oid = event.data?.oid ? ` (${event.data.oid.slice(0, 12)})` : "";
  parts.push(`commit • ${date}`);
  parts.push(`${ref}${oid}`);
}

function renderEvent(parts: string[], event: HFDiscussionEvent): void {
  const author = fmtAuthor(event.author);
  const date = new Date(event.createdAt).toISOString().split("T")[0];
  parts.push("");
  parts.push(`---`);

  switch (event.type) {
    case "comment":
      renderEventComment(parts, event, author, date);
      break;
    case "status-change":
      renderEventStatusChange(parts, event, author, date);
      break;
    case "commit":
      renderEventCommit(parts, event, date);
      break;
    default:
      parts.push(`${event.type} • ${date}`);
      parts.push(author);
      break;
  }
}

function buildDiscussionHeader(
  detail: HFDiscussionDetail,
  parsed: HFPath,
  url: string,
): string[] {
  const header: string[] = [
    `# Discussion #${detail.num}`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
    `**Title:** ${detail.title}`,
    `**Status:** ${detail.status === "closed" ? "closed" : "open"}`,
    `**Type:** ${detail.isPullRequest ? "PR" : "Discussion"}`,
    `**URL:** [${url}](${url})`,
    `**Opened by:** ${fmtAuthor(detail.author)} on ${new Date(detail.createdAt).toISOString().split("T")[0]}`,
  ];
  if (detail.pinned) header.push("**Pinned:** yes");
  if (detail.locked) header.push("**Locked:** yes");
  const orgName = fmtOrgName(detail);
  if (orgName) header.push(orgName);
  return header;
}

function renderDiscussionDetail(
  parsed: HFPath,
  detail: HFDiscussionDetail,
  _signal?: AbortSignal,
): string {
  const url = `${BASE}/${parsed.owner}/${parsed.name}/discussions/${parsed.number}`;
  const parts = buildDiscussionHeader(detail, parsed, url);
  for (const event of detail.events) {
    renderEvent(parts, event);
  }
  return parts.join("\n");
}

function renderDiscussionsList(
  parsed: HFPath,
  discussions: Array<{
    num: number;
    title: string;
    status: string;
    isPullRequest: boolean;
    pinned: boolean;
  }>,
): string {
  const url = `${BASE}/${parsed.owner}/${parsed.name}/discussions`;
  const parts: string[] = [
    `# Discussions`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
    "",
    `${discussions.length} discussion(s) found`,
  ];
  if (parsed.kind !== "model") {
    parts.push(`**Kind:** ${parsed.kind}`);
  }
  for (const d of discussions) {
    const type = d.isPullRequest ? "PR" : "Disc";
    const status = d.status === "closed" ? "○ closed" : "● open";
    const pinned = d.pinned ? " ⓟ" : "";
    parts.push("");
    parts.push(
      `- [${d.num}](${url}/${d.num}) ${status} ${type}${pinned} — ${d.title}`,
    );
  }
  return parts.join("\n");
}

function buildFallback(parsed: HFPath, url: string): string {
  const fallbackParts: string[] = [
    parsed.number ? `# Discussion #${parsed.number}` : `# Discussions`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
  ];
  if (parsed.kind !== "model") fallbackParts.push(`**Kind:** ${parsed.kind}`);
  fallbackParts.push("");
  fallbackParts.push(
    parsed.number
      ? `[View on HuggingFace](${url})`
      : `[View all discussions](${url})`,
  );
  return fallbackParts.join("\n");
}

async function handleDiscussion(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  const baseUrl = `${BASE}/${parsed.owner}/${parsed.name}/discussions`;
  const url = parsed.number ? `${baseUrl}/${parsed.number}` : baseUrl;

  if (parsed.number) {
    try {
      const detail: HFDiscussionDetail = await fetchJSON(
        `models/${parsed.owner}/${parsed.name}/discussions/${parsed.number}`,
        signal,
      );
      return renderDiscussionDetail(parsed, detail, signal);
    } catch {}
  }

  try {
    const result: {
      discussions: Array<{
        num: number;
        title: string;
        status: string;
        isPullRequest: boolean;
        pinned: boolean;
        createdAt: string;
        numComments: number;
        author: { name: string };
      }>;
    } = await fetchJSON(
      `models/${parsed.owner}/${parsed.name}/discussions?limit=50`,
      signal,
    );
    return renderDiscussionsList(parsed, result.discussions);
  } catch {}

  return buildFallback(parsed, url);
}

async function dispatchHF(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  switch (parsed.type) {
    case "file":
      return handleFile(parsed, signal);
    case "tree":
      return handleTree(parsed, signal);
    case "discussion":
      return handleDiscussion(parsed, signal);
    case "discussions":
      return handleDiscussion(parsed, signal);
    case "repo":
      return handleRepo(parsed, signal);
  }
}
export const huggingfaceParser = defineParser(
  "HuggingFace",
  (url) => /^https?:\/\/huggingface\.co\//i.test(url),
  parseHFUrl,
  dispatchHF,
);
