import type { MarkdownChunk } from "./chunker";
import {
  generateEmbedding,
  generateEmbeddings,
  findTopK,
  type EmbeddingOptions,
} from "./embeddings";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const CACHE_DIR = path.join(homedir(), ".cache", "pi-rag");
const STORE_FILE = path.join(CACHE_DIR, "store.json");

export interface IndexedChunk extends MarkdownChunk {
  embedding: number[];
}

export interface SearchResult {
  chunk: MarkdownChunk;
  similarity: number;
}

export interface VectorStoreOptions {
  /** Embedding model to use */
  embeddingModel?: string;
  /** Progress callback */
  onProgress?: (message: string) => void;
}

/**
 * In-memory vector store for markdown chunks
 */
export class MarkdownVectorStore {
  private chunks: IndexedChunk[] = [];
  private embeddingModel: string;
  private onProgress?: (message: string) => void;

  constructor(options: VectorStoreOptions = {}) {
    this.embeddingModel = options.embeddingModel || "Xenova/all-MiniLM-L6-v2";
    this.onProgress = options.onProgress;
  }

  /**
   * Get the number of indexed chunks
   */
  get size(): number {
    return this.chunks.length;
  }

  /**
   * Get all indexed file paths
   */
  getIndexedFiles(): string[] {
    const files = new Set<string>();
    for (const chunk of this.chunks) {
      files.add(chunk.filePath);
    }
    return Array.from(files);
  }

  /**
   * Check if a file is indexed
   */
  hasFile(filePath: string): boolean {
    return this.chunks.some((c) => c.filePath === filePath);
  }

  /**
   * Add chunks to the store with embeddings
   */
  async addChunks(chunks: MarkdownChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const embeddingOptions: EmbeddingOptions = {
      model: this.embeddingModel,
      onProgress: this.onProgress,
    };

    const texts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts, embeddingOptions);

    for (let i = 0; i < chunks.length; i++) {
      this.chunks.push({
        ...chunks[i],
        embedding: embeddings[i].embedding,
      });
    }
  }

  /**
   * Remove chunks for a specific file
   */
  removeFile(filePath: string): number {
    const before = this.chunks.length;
    this.chunks = this.chunks.filter((c) => c.filePath !== filePath);
    return before - this.chunks.length;
  }

  /**
   * Clear all indexed chunks
   */
  clear(): void {
    this.chunks = [];
  }

  /**
   * Search for similar chunks
   */
  async search(
    query: string,
    options: { limit?: number; minSimilarity?: number; filePath?: string } = {},
  ): Promise<SearchResult[]> {
    const { limit = 5, minSimilarity = 0.3, filePath } = options;

    if (this.chunks.length === 0) {
      return [];
    }

    // Filter by file path if specified
    const candidateChunks = filePath
      ? this.chunks.filter((c) => c.filePath === filePath)
      : this.chunks;

    if (candidateChunks.length === 0) {
      return [];
    }

    // Generate query embedding
    const embeddingOptions: EmbeddingOptions = {
      model: this.embeddingModel,
      onProgress: this.onProgress,
    };

    const queryResult = await generateEmbedding(query, embeddingOptions);

    // Find top-k similar chunks
    const embeddings = candidateChunks.map((c) => c.embedding);
    const topK = findTopK(queryResult.embedding, embeddings, limit);

    // Filter by minimum similarity and map to results
    return topK
      .filter((result) => result.similarity >= minSimilarity)
      .map((result) => ({
        chunk: {
          id: candidateChunks[result.index].id,
          filePath: candidateChunks[result.index].filePath,
          type: candidateChunks[result.index].type,
          content: candidateChunks[result.index].content,
          heading: candidateChunks[result.index].heading,
          headingLevel: candidateChunks[result.index].headingLevel,
          codeLanguage: candidateChunks[result.index].codeLanguage,
          startLine: candidateChunks[result.index].startLine,
          endLine: candidateChunks[result.index].endLine,
          metadata: candidateChunks[result.index].metadata,
        },
        similarity: result.similarity,
      }));
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalChunks: number;
    totalFiles: number;
    chunksByType: Record<string, number>;
    chunksByFile: Record<string, number>;
  } {
    const chunksByType: Record<string, number> = {};
    const chunksByFile: Record<string, number> = {};

    for (const chunk of this.chunks) {
      chunksByType[chunk.type] = (chunksByType[chunk.type] || 0) + 1;
      chunksByFile[chunk.filePath] = (chunksByFile[chunk.filePath] || 0) + 1;
    }

    return {
      totalChunks: this.chunks.length,
      totalFiles: Object.keys(chunksByFile).length,
      chunksByType,
      chunksByFile,
    };
  }

  /**
   * Export store data for persistence
   */
  export(): {
    chunks: IndexedChunk[];
    embeddingModel: string;
  } {
    return {
      chunks: this.chunks,
      embeddingModel: this.embeddingModel,
    };
  }

  /**
   * Import store data from persistence
   */
  import(data: { chunks: IndexedChunk[]; embeddingModel: string }): void {
    this.chunks = data.chunks;
    this.embeddingModel = data.embeddingModel;
  }

  /**
   * Save store to disk
   */
  async save(): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true });
    const data = this.export();
    await writeFile(STORE_FILE, JSON.stringify(data));
  }
}

// Global store instance
let globalStore: MarkdownVectorStore | null = null;

/**
 * Get or create the global vector store
 */
export async function getGlobalStore(
  options: VectorStoreOptions = {},
): Promise<MarkdownVectorStore> {
  if (!globalStore) {
    globalStore = new MarkdownVectorStore(options);
    // Try to load from cache
    try {
      const data = JSON.parse(await readFile(STORE_FILE, "utf-8"));
      globalStore.import(data);
    } catch {
      // No cache or invalid, start empty
    }
  }
  return globalStore;
}

/**
 * Reset the global store
 */
export function resetGlobalStore(): void {
  globalStore = null;
}
