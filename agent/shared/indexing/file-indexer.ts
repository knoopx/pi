import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { FileIndexEntry, IndexedSection } from "./cache";
import {
  fileDigest,
  loadCache,
  saveCache,
  runIndexBuild,
  getChangedFiles,
} from "./cache";
import { embedTexts, type EmbedConfig } from "../embeddings/engine";
import type { ProgressState } from "../embeddings/progress";

interface ParsedFile {
  content: string;
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

  export async function buildIndex(
    indexer: FileIndexer,
    embedConfig: EmbedConfig,
  ): Promise<IndexedSection[]> {
    const files = await indexer.findFiles();
    if (files.length === 0) return [];

    const fileDigests = new Map<string, string>();
    for (const file of files) {
      const info = await indexer.readFile(file);
      if (!info) continue;
      fileDigests.set(file, fileDigest(info.content));
    }

    return runIndexBuild<IndexedSection>(
      loadCache,
      saveCache,
      fileDigests,
      (stale, cleanedChunks, unchangedFiles) =>
        rebuildAndMerge(
          indexer,
          stale,
          cleanedChunks,
          unchangedFiles,
          embedConfig,
        ),
    );
  }
}

async function rebuildAndMerge(
  indexer: FileIndex.FileIndexer,
  staleFiles: string[],
  cleanedChunks: IndexedSection[],
  unchangedFiles: string[],
  embedConfig: EmbedConfig,
): Promise<IndexedSection[]> {
  const changedFiles = getChangedFiles(staleFiles, unchangedFiles);

  if (changedFiles.length === 0) {
    return cleanedChunks;
  }

  const rawChunks: FileIndex.RawChunk[] = [];
  for (const file of changedFiles) {
    const info = await indexer.readFile(file);
    if (!info) continue;
    const chunks = indexer.parseChunks(file, info);
    rawChunks.push(...chunks);
  }

  if (rawChunks.length === 0) {
    return cleanedChunks;
  }

  const maxChars = indexer.chunkMaxChars ?? 1000;
  const truncatedChunks = rawChunks.map((c) => ({
    ...c,
    text: c.text.length > maxChars ? c.text.slice(0, maxChars) : c.text,
  }));

  const progress: ProgressState = { message: "Indexing files..." };
  const embeddings = await embedTexts(
    truncatedChunks.map((c) => c.text),
    embedConfig,
    progress,
    120_000,
  );

  const newChunks = indexer.mapToIndexed(truncatedChunks, embeddings);

  return [...cleanedChunks, ...newChunks];
}
