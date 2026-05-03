import { readFile, stat } from "node:fs/promises";
import { relative } from "node:path";
import type { Chunk } from "../../shared/embeddings/chunker";
import {
  SKILLS_DIR,
  deriveSkillName,
  parseMarkdown,
  chunkByElements,
  stripFrontmatter,
} from "./chunker";
import * as SharedFileIndex from "../../shared/indexing/file-indexer";
import {
  loadSkillReminderCache as loadCache,
  saveSkillReminderCache as saveCache,
} from "./cache";
import { isCacheStale } from "../../shared/cache/cache-helpers";
import { embedTexts } from "../../shared/embeddings/engine";
import type { Config } from "./config";
import type { IndexedSection } from "../../shared/indexing/cache";

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

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

function hasEnoughBodyContent(text: string): boolean {
  const lines = text.split("\n");
  if (lines.length <= 1) return false;
  const body = lines.slice(1).join("\n").trim();
  return body.length >= 30;
}

function mapToRawChunks(
  chunks: Chunk[],
  skill: string,
  filePath: string,
  maxChars: number,
): RawChunk[] {
  return chunks.flatMap((chunk) => {
    const text = truncateText(chunk.text.trim(), maxChars);
    if (!text || !hasEnoughBodyContent(text)) return [];
    const section = extractSection(text);
    return [{ skill, file: relative(SKILLS_DIR, filePath), section, text }];
  });
}

async function parseFile(
  file: string,
  maxChars: number,
): Promise<RawChunk[] | null> {
  const info = await readFileInfo(file);
  if (!info) return null;

  const skill = deriveSkillName(file);
  if (!skill) return null;

  const body = stripFrontmatter(info.content);
  if (!body.trim()) return null;

  return mapToRawChunks(parseChunks(body), skill, file, maxChars);
}

async function collectRawChunks(
  files: string[],
  maxChars: number,
): Promise<{ rawChunks: RawChunk[]; mtimes: Record<string, number> }> {
  const rawChunks: RawChunk[] = [];
  const mtimes: Record<string, number> = {};

  for (const file of files) {
    const info = await readFileInfo(file);
    if (!info) continue;
    mtimes[file] = info.mtimeMs;

    const chunks = await parseFile(file, maxChars);
    if (!chunks) continue;
    rawChunks.push(...chunks);
  }

  return { rawChunks, mtimes };
}

async function embedAndSave(
  rawChunks: RawChunk[],
  mtimes: Record<string, number>,
  config: Config,
): Promise<IndexedSection[]> {
  const embeddings = await embedTexts(
    rawChunks.map((c) => c.text),
    config,
    120_000,
  );

  const chunks: IndexedSection[] = rawChunks.map((chunk, i) => ({
    skill: chunk.skill,
    file: chunk.file,
    section: chunk.section,
    text: chunk.text,
    embedding: embeddings[i],
  }));

  await saveCache({ mtimes, chunks });
  return chunks;
}

async function tryLoadCached(
  files: string[],
): Promise<IndexedSection[] | null> {
  const cached = await loadCache();
  if (cached && !(await isCacheStale(cached.mtimes, files))) {
    return cached.chunks;
  }
  return null;
}

export namespace Indexer {
  export async function build(config: Config): Promise<IndexedSection[]> {
    const files = await SharedFileIndex.FileIndex.findMarkdownFiles(SKILLS_DIR);

    const cached = await tryLoadCached(files);
    if (cached) return cached;

    const { rawChunks, mtimes } = await collectRawChunks(
      files,
      config.chunkMaxChars,
    );
    if (!rawChunks.length) return [];

    return embedAndSave(rawChunks, mtimes, config);
  }
}
