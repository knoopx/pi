// Lazy import transformers to avoid loading at startup
let transformersModule: typeof import("@huggingface/transformers") | null =
  null;

async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import("@huggingface/transformers");
  }
  return transformersModule;
}

// Pipeline cache to avoid re-initializing models
const pipelineCache = new Map<string, unknown>();

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export interface EmbeddingOptions {
  /** Model ID for embedding generation (default: Xenova/all-MiniLM-L6-v2) */
  model?: string;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

type FeatureExtractionPipeline = (
  input: string | string[],
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * Get or create an embedding pipeline
 */
async function getEmbeddingPipeline(
  model: string,
  onProgress?: (message: string) => void,
): Promise<FeatureExtractionPipeline> {
  const cacheKey = `feature-extraction:${model}`;

  if (pipelineCache.has(cacheKey)) {
    return pipelineCache.get(cacheKey) as FeatureExtractionPipeline;
  }

  onProgress?.(
    `Loading embedding model ${model}... This may take a moment on first use.`,
  );

  const { pipeline } = await getTransformers();
  const pipe = await pipeline("feature-extraction", model, {
    dtype: "q8",
    device: "cpu",
  });

  pipelineCache.set(cacheKey, pipe);
  return pipe as unknown as FeatureExtractionPipeline;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {},
): Promise<EmbeddingResult> {
  const model = options.model || DEFAULT_MODEL;
  const pipeline = await getEmbeddingPipeline(model, options.onProgress);

  const output = await pipeline(text, {
    pooling: "mean",
    normalize: true,
  });

  return {
    embedding: Array.from(output.data),
    model,
  };
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {},
): Promise<EmbeddingResult[]> {
  const model = options.model || DEFAULT_MODEL;
  const pipeline = await getEmbeddingPipeline(model, options.onProgress);

  const results: EmbeddingResult[] = [];

  // Process in batches to avoid memory issues
  const batchSize = 32;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    options.onProgress?.(
      `Generating embeddings: ${Math.min(i + batchSize, texts.length)}/${texts.length}`,
    );

    for (const text of batch) {
      const output = await pipeline(text, {
        pooling: "mean",
        normalize: true,
      });

      results.push({
        embedding: Array.from(output.data),
        model,
      });
    }
  }

  return results;
}

/**
 * Compute cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same dimension");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Find top-k most similar embeddings
 */
export function findTopK(
  queryEmbedding: number[],
  embeddings: number[][],
  k: number,
): Array<{ index: number; similarity: number }> {
  const similarities = embeddings.map((emb, index) => ({
    index,
    similarity: cosineSimilarity(queryEmbedding, emb),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, k);
}
