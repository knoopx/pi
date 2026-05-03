import type { ProgressState } from "./progress";
import { renderEmbedding } from "./progress";

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
  serverUrl: string,
  model: string,
  timeoutMs: number,
): Promise<number[][]> {
  const res = await fetchWithTimeout(
    serverUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
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

const CHARS_PER_TOKEN = 4;
const MAX_INPUT_TOKENS = 512;
const MAX_BATCH_TOKENS = 2000;

export interface EmbedConfig {
  serverUrl: string;
  embeddingModel: string;
}

export async function embedTexts(
  texts: string[],
  config: EmbedConfig,
  progressState: ProgressState,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<number[][]> {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentTokens = 0;

  for (const text of texts) {
    const estimatedTokens = Math.ceil(text.length / CHARS_PER_TOKEN);

    if (estimatedTokens > MAX_INPUT_TOKENS) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentTokens = 0;
      }
      batches.push([text]);
      continue;
    }

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

  const CONCURRENCY = 5;
  const results: Array<{ result: number[][]; index: number }> = new Array(
    batches.length,
  );

  let nextIndex = 0;
  let doneCount = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (nextIndex < batches.length) {
      const i = nextIndex++;
      results[i] = {
        result: await embedBatch(
          batches[i],
          config.serverUrl,
          config.embeddingModel,
          timeoutMs,
        ),
        index: i,
      };
      renderEmbedding(progressState, ++doneCount, batches.length);
    }
  });

  await Promise.all(workers);

  const allEmbeddings: number[][] = [];
  for (let i = 0; i < batches.length; i++) {
    allEmbeddings.push(...results[i].result);
  }

  return allEmbeddings;
}

export async function embedQuery(
  query: string,
  config: EmbedConfig,
  progressState: ProgressState,
): Promise<number[] | null> {
  try {
    const embeddings = await embedTexts([query], config, progressState);
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
