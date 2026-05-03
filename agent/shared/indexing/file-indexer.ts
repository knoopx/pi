import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { FileIndexEntry, IndexedSection } from "./cache";
import { loadCache, saveCache } from "./cache";
import { tryLoadCached } from "../cache/cache-helpers";
import { embedTexts, type EmbedConfig } from "../embeddings/engine";

interface ParsedFile {
  content: string;
  mtimeMs: number;
}

export namespace FileIndex {
  export interface RawChunk {
    source: string;
    file: string;
    section: string;
    text: string;
  }

  export async function findMarkdownFiles(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const results = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) return findMarkdownFiles(fullPath);
          if (entry.name.toLowerCase().endsWith(".md")) return [fullPath];
          return [];
        }),
      );
      return results.flat();
    } catch {
      return [];
    }
  }

  export interface FileIndexer {
    findFiles(): Promise<string[]>;
    readFile(file: string): Promise<ParsedFile | null>;
    parseChunks(filePath: string, content: ParsedFile): RawChunk[];
    mapToIndexed(raw: RawChunk[], embeddings: number[][]): IndexedSection[];
    chunkMaxChars?: number;
  }

  async function collectRawChunks(indexer: FileIndexer): Promise<{
    rawChunks: RawChunk[];
    mtimes: Record<string, number>;
  }> {
    const files = await indexer.findFiles();
    const rawChunks: RawChunk[] = [];
    const mtimes: Record<string, number> = {};

    for (const file of files) {
      const info = await indexer.readFile(file);
      if (!info) continue;
      mtimes[file] = info.mtimeMs;

      const chunks = indexer.parseChunks(file, info);
      rawChunks.push(...chunks);
    }

    return { rawChunks, mtimes };
  }

  export async function buildIndex(
    indexer: FileIndexer,
    embedConfig: EmbedConfig,
  ): Promise<IndexedSection[]> {
    const files = await indexer.findFiles();

    const cached = await tryLoadCached(files, loadCache);
    if (cached) return cached;

    const { rawChunks, mtimes } = await collectRawChunks(indexer);
    if (!rawChunks.length) return [];

    const maxChars = indexer.chunkMaxChars ?? 1000;
    const truncatedChunks = rawChunks.map((c) => ({
      ...c,
      text: c.text.length > maxChars ? c.text.slice(0, maxChars) : c.text,
    }));

    const embeddings = await embedTexts(
      truncatedChunks.map((c) => c.text),
      embedConfig,
      120_000,
    );

    const indexed = indexer.mapToIndexed(truncatedChunks, embeddings);

    await saveCache({ mtimes, chunks: indexed });
    return indexed;
  }
}
