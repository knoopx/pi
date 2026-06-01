import { filterUserTags } from "../../../../../shared/format/hf-tags";
import { fetchJSON } from "../http";
import type { HFModelDetail, HFTreeEntry, HFPath } from "../types";
import { renderLicenseAndBase } from "./repo";
import { renderFileListSection } from "./files";

async function fetchModelDetail(
  modelId: string,
  signal?: AbortSignal,
): Promise<HFModelDetail> {
  return fetchJSON<HFModelDetail>(`models/${modelId}`, signal);
}

function captureError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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
        `models/${owner}/${name}/tree/${revision}`,
        signal,
      );
    } catch (error) {
      lastError = captureError(error);
    }
  }
  throw lastError ?? new Error("Failed to fetch model tree");
}

function buildTransformerMeta(detail: HFModelDetail): string[] {
  const ti = detail.transformersInfo;
  if (!ti) return [];
  const meta: string[] = [];
  if (ti.auto_model) meta.push(`auto_model=${ti.auto_model}`);
  if (ti.processor) meta.push(`processor=${ti.processor}`);
  return meta;
}

function renderTransformersInfo(parts: string[], detail: HFModelDetail): void {
  const meta = buildTransformerMeta(detail);
  if (meta.length) {
    parts.push(`**Transformers:** ${meta.join(", ")}`);
  }
}

function hasConfigData(detail: HFModelDetail): boolean {
  return !!(detail.config?.architectures?.length || detail.config?.model_type);
}

function renderConfigInfo(parts: string[], detail: HFModelDetail): void {
  const config = detail.config;
  if (!hasConfigData(detail) || !config) return;
  parts.push("");
  parts.push("## Configuration");
  appendArchitectures(parts, config);
  appendModelType(parts, config);
  renderTransformersInfo(parts, detail);
}

function appendArchitectures(
  parts: string[],
  config: HFModelDetail["config"],
): void {
  if (config?.architectures?.length) {
    parts.push(`**Architecture:** ${config.architectures.join(", ")}`);
  }
}

function appendModelType(
  parts: string[],
  config: HFModelDetail["config"],
): void {
  if (config?.model_type) {
    parts.push(`**Model type:** ${config.model_type}`);
  }
}

function formatTag(tag: string): string {
  const colon = tag.indexOf(":");
  if (colon <= 0) return tag;
  return `${tag.slice(0, colon)}: ${tag.slice(colon + 1)}`;
}

function shouldRenderTags(cardTags: string[]): boolean {
  return cardTags.length > 0 && cardTags.length <= 10;
}

function renderCardData(parts: string[], detail: HFModelDetail): void {
  const cardData = detail.cardData as Record<string, unknown> | undefined;
  if (!Array.isArray(detail.tags)) return;
  const cardTags = filterUserTags(detail.tags);
  renderLicenseAndBase(parts, detail.tags, cardData);
  if (shouldRenderTags(cardTags)) {
    parts.push("");
    parts.push("**Tags:**");
    for (const tag of cardTags) {
      parts.push(`- ${formatTag(tag)}`);
    }
  }
}

function joinValue(value: unknown): string {
  if (Array.isArray(value)) return (value as string[]).join(", ");
  return String(value);
}

function renderCardDataFields(
  parts: string[],
  cardData: Record<string, unknown> | undefined,
): void {
  if (!cardData) return;
  if (cardData.language) {
    parts.push("");
    parts.push("**Languages:** " + joinValue(cardData.language));
  }
  if (cardData.datasets) {
    parts.push("**Datasets:** " + joinValue(cardData.datasets));
  }
}

function formatGatedStatus(gated: string | boolean): string {
  return `gated: ${typeof gated === "string" ? gated : "yes"}`;
}

function collectStatusParts(detail: HFModelDetail): string[] {
  const parts: string[] = [];
  if (detail.gated) parts.push(formatGatedStatus(detail.gated));
  if (detail.private) parts.push("private: yes");
  return parts;
}

function renderStatusInfo(parts: string[], detail: HFModelDetail): void {
  const statusParts = collectStatusParts(detail);
  if (detail.disabled) statusParts.push("disabled: yes");
  if (statusParts.length) {
    parts.push("");
    parts.push(statusParts.join(" • "));
  }
}

function extractDatasetName(rm: { dataset?: { name?: string } }): string {
  return rm.dataset?.name ?? "?";
}

function extractMetricName(
  metric: { type?: string; name?: string } | undefined,
): string {
  if (metric?.name) return metric.name;
  if (metric?.type) return metric.type;
  return "score";
}

function extractBenchmarkFields(r: Record<string, unknown>): {
  datasetName: string;
  metricName: string;
  value: string;
} {
  const rm = r as { dataset?: { name?: string }; metrics?: unknown[] };
  const metric = rm.metrics?.[0] as
    | { type?: string; name?: string; value?: number }
    | undefined;
  return {
    datasetName: extractDatasetName(rm),
    metricName: extractMetricName(metric),
    value: formatMetricValue(metric?.value),
  };
}

function formatBenchmarkResult(r: Record<string, unknown>): string {
  const { datasetName, metricName, value } = extractBenchmarkFields(r);
  return `- ${datasetName}: ${metricName} = ${value}`;
}

function formatMetricValue(value: unknown): string {
  if (typeof value === "number") return value.toFixed(2);
  return String(value ?? "?");
}

function hasModelIndex(detail: HFModelDetail): boolean {
  const modelIndex = detail["model-index"];
  return Array.isArray(modelIndex) && modelIndex.length > 0;
}

function renderBenchmarks(parts: string[], detail: HFModelDetail): void {
  if (!hasModelIndex(detail)) return;
  const modelIndex = detail["model-index"] as Record<string, unknown>[];
  const results = modelIndex.flatMap(
    (mi) =>
      ((mi as { results?: unknown[] }).results ?? []) as Record<
        string,
        unknown
      >[],
  );
  if (!results.length) return;
  parts.push("");
  parts.push("## Benchmarks");
  for (const r of results) {
    parts.push(formatBenchmarkResult(r));
  }
}

function isGgufModel(info: Record<string, unknown>): boolean {
  return Array.isArray(info.tags) && info.tags.includes("gguf");
}

async function renderModelTreeSection(
  parts: string[],
  parsed: HFPath,
  isGguf: boolean,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const tree = await fetchModelTree(parsed.owner + "/" + parsed.name, signal);
    renderFileListSection(parts, parsed, tree, isGguf);
  } catch {
    // tree fetch is optional
  }
}

async function renderModelDetailSections(
  parts: string[],
  parsed: HFPath,
  isGguf: boolean,
  signal?: AbortSignal,
): Promise<void> {
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
    renderBenchmarks(parts, detail);

    await renderModelTreeSection(parts, parsed, isGguf, signal);
  } catch {
    // model detail fetch failed
  }
}

export async function renderModelDetails(
  parts: string[],
  parsed: HFPath,
  info: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<void> {
  const isGguf = isGgufModel(info);
  await renderModelDetailSections(parts, parsed, isGguf, signal);
}
