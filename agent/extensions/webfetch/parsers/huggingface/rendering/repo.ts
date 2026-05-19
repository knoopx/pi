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

function addKindSpecificHeader(
  parts: string[],
  kind: HFPath["kind"],
  info: Record<string, unknown>,
): void {
  if (kind === "model" && typeof info.pipeline_tag === "string") {
    parts.push(`**Pipeline:** ${info.pipeline_tag}`);
  } else if (kind === "space" && typeof info.sdk === "string") {
    parts.push(`**SDK:** ${info.sdk}`);
  }
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
