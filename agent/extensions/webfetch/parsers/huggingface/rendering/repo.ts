import { formatIsoAge } from "../../../../../shared/format/time-formatting";
import { formatDownloadsShort } from "../../../../../shared/format/text-formatting";
import { fetchJSON, fetchRaw, repoApiPath } from "../http";
import type { HFPath, HFTreeEntry, RepoBodyOptions } from "../types";

function tagToBullet(tag: string): string {
  const colon = tag.indexOf(":");
  if (colon > 0) return `${tag.slice(0, colon)}: ${tag.slice(colon + 1)}`;
  return tag;
}

function renderTags(
  parts: string[],
  tags: string[],
  filterFn?: (tag: string) => boolean,
  limit?: number,
): void {
  const rendered = formatTagList(tags, filterFn, limit);
  if (!rendered.length) return;
  parts.push("");
  parts.push("**Tags:**");
  parts.push(...rendered);
}

function formatTagList(
  tags: string[],
  filterFn?: (tag: string) => boolean,
  limit?: number,
): string[] {
  const filtered = filterFn ? tags.filter(filterFn) : tags;
  const sliced = limit ? filtered.slice(0, limit) : filtered;
  return sliced.map((tag) => `- ${tagToBullet(tag)}`);
}

function extractLicense(
  tags: string[],
  cardData?: Record<string, unknown>,
): string | null {
  if (cardData?.license) return String(cardData.license);
  const tag = tags.find((t) => t.startsWith("license:"));
  return tag ? tag.replace("license:", "") : null;
}

function extractBaseModelFromCard(
  cardData: Record<string, unknown>,
): string | null {
  const base = cardData.base_model;
  if (!base) return null;
  return Array.isArray(base) ? (base as string[]).join(", ") : String(base);
}

function extractBaseModelFromTags(tags: string[]): string | null {
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

function extractBaseModel(
  tags: string[],
  cardData?: Record<string, unknown>,
): string | null {
  if (cardData?.base_model) return extractBaseModelFromCard(cardData);
  return extractBaseModelFromTags(tags);
}

function renderLicenseAndBase(
  parts: string[],
  tags: string[] | undefined,
  cardData?: Record<string, unknown>,
): void {
  if (!tags) return;
  const line = buildLicenseAndBaseLine(tags, cardData);
  if (!line) return;
  parts.push("");
  parts.push(line);
}

function buildLicenseAndBaseLine(
  tags: string[],
  cardData?: Record<string, unknown>,
): string | null {
  const license = extractLicense(tags, cardData);
  const baseModel = extractBaseModel(tags, cardData);
  const fields = [formatLicense(license), formatBaseModel(baseModel)].filter(
    Boolean,
  );
  return fields.length > 0 ? fields.join(" • ") : null;
}

function formatLicense(license: string | null): string | null {
  return license ? `**License:** ${license}` : null;
}

function formatBaseModel(baseModel: string | null): string | null {
  return baseModel ? `**Base model:** ${baseModel}` : null;
}

function buildMetaParts(opts: RepoBodyOptions): string[] {
  const metaParts: string[] = [];
  if (opts.downloads !== undefined) {
    metaParts.push(`downloads: ${formatDownloadsShort(opts.downloads)}`);
  }
  if (opts.lastModified) {
    metaParts.push(`updated: ${formatIsoAge(opts.lastModified)}`);
  }
  return metaParts;
}

function renderRepoMetadata(parts: string[], opts: RepoBodyOptions): void {
  const metaParts = buildMetaParts(opts);
  if (metaParts.length === 0) return;
  parts.push("");
  parts.push(metaParts.join(" • "));
}

function addKindSpecificHeader(
  parts: string[],
  kind: HFPath["kind"],
  info: Record<string, unknown>,
): void {
  const header = buildKindHeader(kind, info);
  if (header) parts.push(header);
}

function buildKindHeader(
  kind: HFPath["kind"],
  info: Record<string, unknown>,
): string | null {
  if (kind === "model" && typeof info.pipeline_tag === "string") {
    return `**Pipeline:** ${info.pipeline_tag}`;
  }
  if (kind === "space" && typeof info.sdk === "string") {
    return `**SDK:** ${info.sdk}`;
  }
  return null;
}

function makeTagFilter(
  kind: HFPath["kind"],
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

function extractGatedValue(
  info: Record<string, unknown>,
): boolean | string | undefined {
  const gated = info.gated;
  if (typeof gated === "boolean" || typeof gated === "string") return gated;
  return undefined;
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
    gated: extractGatedValue(info),
    tagFilter: makeTagFilter(parsed.kind),
    tagLimit: parsed.kind === "dataset" ? 20 : undefined,
    extraDescription: datasetDesc,
  };
}

async function fetchReadme(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const tree = await fetchJSON<HFTreeEntry[]>(
      `${repoApiPath(parsed)}/tree/main`,
      signal,
    );
    const readmeEntry = tree.find((e) => e.path === "README.md");
    if (readmeEntry) {
      return await fetchRaw(parsed, "main", "README.md", signal);
    }
  } catch {
    // Graceful degradation: cannot fetch repo README
  }
  return "";
}

function appendReadme(parts: string[], readme: string): void {
  if (readme) {
    parts.push("");
    parts.push(readme);
  }
}

async function renderRepoReadme(
  parts: string[],
  opts: RepoBodyOptions,
  parsed: HFPath,
  signal: AbortSignal | undefined,
): Promise<void> {
  const readme = await fetchReadme(parsed, signal);
  if (readme) {
    appendReadme(parts, readme);
    return;
  }
  if (opts.extraDescription) {
    parts.push("");
    parts.push(opts.extraDescription);
  }
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
  await renderRepoReadme(parts, opts, parsed, signal);
}

export async function renderRepo(
  parsed: HFPath,
  info: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const title = safeString(info.id, "unknown")!;
  const parts: string[] = [`# ${title}`];
  addKindSpecificHeader(parts, parsed.kind, info);

  await renderRepoBody(
    parts,
    buildRepoBodyOptions(info, parsed),
    parsed,
    signal,
  );

  return parts.join("\n");
}

export { renderLicenseAndBase };
