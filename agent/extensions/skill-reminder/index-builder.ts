import { readFile, stat } from "node:fs/promises";
import { relative } from "node:path";
import {
  type Chunk,
  SKILLS_DIR,
  findMarkdownFiles,
  deriveSkillName,
  parseMarkdown,
  chunkByElements,
  stripFrontmatter,
} from "./parser";
import { loadCache, saveCache, isCacheStale } from "./cache";
import { embedTexts, type EmbedProgress } from "./embeddings";
import type { SkillReminderConfig } from "./settings";
import type { IndexedChunk } from "./cache";

interface RawChunk {
  skill: string;
  file: string;
  section: string;
  text: string;
}

function extractSection(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  if (/^#+\s*/.test(firstLine)) return firstLine.replace(/^#+\s*/, "");
  return "overview";
}

async function readFileInfo(
  file: string,
): Promise<{ content: string; mtimeMs: number } | null> {
  try {
    const s = await stat(file);
    const content = await readFile(file, "utf-8");
    return { content, mtimeMs: s.mtimeMs };
  } catch {
    return null;
  }
}

function parseChunks(body: string): Chunk[] {
  const tree = parseMarkdown(body);
  return chunkByElements(tree);
}

function mapToRawChunks(
  chunks: Chunk[],
  skill: string,
  filePath: string,
): RawChunk[] {
  return chunks.flatMap((chunk) => {
    const text = chunk.text.trim();
    if (!text) return [];
    const section = extractSection(text);
    return [{ skill, file: relative(SKILLS_DIR, filePath), section, text }];
  });
}

async function parseFile(file: string): Promise<RawChunk[] | null> {
  const info = await readFileInfo(file);
  if (!info) return null;

  const skill = deriveSkillName(file);
  if (!skill) return null;

  const body = stripFrontmatter(info.content);
  if (!body.trim()) return null;

  return mapToRawChunks(parseChunks(body), skill, file);
}

async function collectRawChunks(
  files: string[],
): Promise<{ rawChunks: RawChunk[]; mtimes: Record<string, number> }> {
  const rawChunks: RawChunk[] = [];
  const mtimes: Record<string, number> = {};

  for (const file of files) {
    const info = await readFileInfo(file);
    if (!info) continue;
    mtimes[file] = info.mtimeMs;

    const chunks = await parseFile(file);
    if (!chunks) continue;
    rawChunks.push(...chunks);
  }

  return { rawChunks, mtimes };
}

async function embedAndSave(
  rawChunks: RawChunk[],
  mtimes: Record<string, number>,
  config: SkillReminderConfig,
  embedProgress?: EmbedProgress,
): Promise<IndexedChunk[]> {
  const embeddings = await embedTexts(
    rawChunks.map((c) => c.text),
    config,
    120_000,
    embedProgress,
  );

  const chunks: IndexedChunk[] = rawChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i],
  }));

  await saveCache({ mtimes, chunks });
  return chunks;
}

async function tryLoadCached(files: string[]): Promise<IndexedChunk[] | null> {
  const cached = await loadCache();
  if (cached && !(await isCacheStale(cached.mtimes, files))) {
    return cached.chunks;
  }
  return null;
}

export interface BuildIndexProgress {
  onEmbedBatch?: (batchIndex: number, totalBatches: number) => void;
}

export async function buildIndex(
  config: SkillReminderConfig,
  progress?: BuildIndexProgress,
): Promise<IndexedChunk[]> {
  const files = await findMarkdownFiles(SKILLS_DIR);

  const cached = await tryLoadCached(files);
  if (cached) return cached;

  const { rawChunks, mtimes } = await collectRawChunks(files);
  if (!rawChunks.length) return [];

  return embedAndSave(rawChunks, mtimes, config, {
    onBatch: progress?.onEmbedBatch,
  });
}
