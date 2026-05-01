import type { SkillReminderConfig } from "./settings";

const DEFAULT_TIMEOUT_MS = 3_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function embedBatch(
  texts: string[],
  config: SkillReminderConfig,
  timeoutMs: number,
): Promise<number[][]> {
  const res = await fetchWithTimeout(
    config.serverUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.embeddingModel,
        input: texts.length === 1 ? texts[0] : texts,
      }),
    },
    timeoutMs,
  );

  if (!res.ok) {
    throw new Error(
      `Embedding request failed: ${res.status} ${await res.text()}`,
    );
  }

  const data = (await res.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data.map((d) => d.embedding);
}

export interface EmbedProgress {
  onBatch?: (batchIndex: number, totalBatches: number) => void;
}

// Rough token estimate: ~4 chars per token for this model.
const CHARS_PER_TOKEN = 4;
const MAX_BATCH_TOKENS = 2000;

export async function embedTexts(
  texts: string[],
  config: SkillReminderConfig,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  progress?: EmbedProgress,
): Promise<number[][]> {
  // Split into batches respecting token budget.
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentTokens = 0;

  for (const text of texts) {
    const estimatedTokens = Math.ceil(text.length / CHARS_PER_TOKEN);

    // Flush batch if adding this text would exceed budget.
    if (
      currentTokens + estimatedTokens > MAX_BATCH_TOKENS &&
      currentBatch.length > 0
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(text);
    currentTokens += estimatedTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < batches.length; i++) {
    const result = await embedBatch(batches[i], config, timeoutMs);
    allEmbeddings.push(...result);
    progress?.onBatch?.(i + 1, batches.length);
  }

  return allEmbeddings;
}

export async function embedQuery(
  query: string,
  config: SkillReminderConfig,
): Promise<number[] | null> {
  try {
    const embeddings = await embedTexts([query], config);
    return embeddings[0] ?? null;
  } catch {
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i],
      bi = b[i];
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
