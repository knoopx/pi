import { filterUserTags } from "../../../../../shared/format/hf-tags";
import { fetchJSON, BASE } from "../http";
import type { HFModelDetail, HFTreeEntry, HFPath } from "../types";
import { renderLicenseAndBase } from "./repo";

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
        `models/${owner}/${name}/tree/${revision}`,
        signal,
      );
    } catch (error) {
      if (error instanceof Error) lastError = error;
    }
  }
  throw lastError ?? new Error("Failed to fetch model tree");
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
      const colon = tag.indexOf(":");
      const formatted =
        colon > 0 ? `${tag.slice(0, colon)}: ${tag.slice(colon + 1)}` : tag;
      parts.push(`- ${formatted}`);
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

function formatBenchmarkResult(r: Record<string, unknown>): string {
  const rm = r as { dataset?: { name?: string }; metrics?: unknown[] };
  const metric = rm.metrics?.[0] as
    | { type?: string; name?: string; value?: number }
    | undefined;

  const datasetName = rm.dataset?.name ?? "?";
  const metricName = metric?.name ?? metric?.type ?? "score";
  const value = formatMetricValue(metric?.value);

  return `- ${datasetName}: ${metricName} = ${value}`;
}

function formatMetricValue(value: unknown): string {
  if (typeof value === "number") return value.toFixed(2);
  return String(value ?? "?");
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

function formatSize(bytes: number): string {
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(0)}MB`;
  return `${(bytes / 1024).toFixed(0)}KB`;
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

function renderGgufFiles(
  parts: string[],
  parsed: HFPath,
  tree: HFTreeEntry[],
): void {
  const ggufFiles = tree.filter(
    (f) => f.type === "file" && f.path.endsWith(".gguf"),
  );
  if (ggufFiles.length === 0) return;
  parts.push("");
  parts.push(`## Quant files (${ggufFiles.length})`);
  for (const f of ggufFiles) {
    const size = (f.lfs as { size?: number } | undefined)?.size ?? f.size ?? 0;
    const format = guessQuantFormat(f.path);
    parts.push(
      `- ${format} — [${f.path}](${BASE}/${parsed.owner}/${parsed.name}/blob/main/${encodeURIComponent(f.path)}) (${formatSize(size)})`,
    );
  }
}

function renderWeightFiles(
  parts: string[],
  parsed: HFPath,
  tree: HFTreeEntry[],
): void {
  const weightExts = [".safetensors", ".bin", ".pt", ".onnx"];
  const weights = tree
    .filter(
      (f) =>
        f.type === "file" && weightExts.some((ext) => f.path.endsWith(ext)),
    )
    .sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
  if (weights.length === 0) return;
  parts.push("");
  const totalSize = weights.reduce((s, f) => s + (f.size ?? 0), 0);
  parts.push(
    `## Model weights (${weights.length} files, ${formatSize(totalSize)} total)`,
  );
  for (const w of weights) {
    const size = (w.lfs as { size?: number } | undefined)?.size ?? w.size ?? 0;
    parts.push(
      `- [${w.path}](${BASE}/${parsed.owner}/${parsed.name}/blob/main/${encodeURIComponent(w.path)}) (${formatSize(size)})`,
    );
  }
}

function renderFileListSection(
  parts: string[],
  parsed: HFPath,
  tree: HFTreeEntry[],
  isGguf: boolean,
): void {
  if (isGguf) {
    renderGgufFiles(parts, parsed, tree);
  } else {
    renderWeightFiles(parts, parsed, tree);
  }
}

export async function renderModelDetails(
  parts: string[],
  parsed: HFPath,
  info: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<void> {
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
    } catch {
      // tree fetch is optional
    }
  } catch {
    // model detail fetch failed
  }
}
