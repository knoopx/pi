import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
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
import type { ProgressState } from "../../shared/embeddings/progress";
import { embedTexts } from "../../shared/embeddings/engine";
import type { Config } from "./config";
import {
  type IndexedSection,
  runIndexBuild,
  getChangedFiles,
  fileDigest,
} from "../../shared/indexing/cache";

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

export function mapToRawChunks(
  chunks: Chunk[],
  skill: string,
  filePath: string,
  maxChars: number,
): RawChunk[] {
  return chunks.flatMap((chunk) => {
    const text = truncateText(chunk.text.trim(), maxChars);
    if (!text || !hasEnoughBodyContent(text)) return [];
    const section = extractSection(text);
    return [
      { skill, file: `~/${relative(homedir(), filePath)}`, section, text },
    ];
  });
}

async function parseFile(
  file: string,
  maxChars: number,
): Promise<RawChunk[] | null> {
  let content: string;
  try {
    content = await readFile(file, "utf-8");
  } catch {
    return null;
  }

  const skill = deriveSkillName(file);
  if (!skill) return null;

  const body = stripFrontmatter(content);
  if (!body.trim()) return null;

  return mapToRawChunks(parseChunks(body), skill, file, maxChars);
}

export async function build(config: Config): Promise<IndexedSection[]> {
  const files = await SharedFileIndex.FileIndex.findMarkdownFiles(SKILLS_DIR);
  if (files.length === 0) return [];

  // Build per-file content → digest map (no stat calls)
  const fileDigests = new Map<string, string>();
  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch {
      continue;
    }
    fileDigests.set(file, fileDigest(content));
  }

  return runIndexBuild<IndexedSection>(
    loadCache,
    saveCache,
    fileDigests,
    (stale, cleanedChunks, unchangedFiles) =>
      rebuildAndMerge(stale, cleanedChunks, unchangedFiles, config),
  );
}

async function rebuildAndMerge(
  staleFiles: string[],
  cleanedChunks: IndexedSection[],
  unchangedFiles: string[],
  config: Config,
): Promise<IndexedSection[]> {
  const changedFiles = getChangedFiles(staleFiles, unchangedFiles);

  if (changedFiles.length === 0) {
    return cleanedChunks;
  }

  // Parse only changed files
  const rawChunks: RawChunk[] = [];
  for (const file of changedFiles) {
    const chunks = await parseFile(file, config.chunkMaxChars);
    if (!chunks) continue;
    rawChunks.push(...chunks);
  }

  if (rawChunks.length === 0) {
    return cleanedChunks;
  }

  // Embed only changed file chunks
  const progress: ProgressState = { message: "Indexing skills..." };
  const embeddings = await embedTexts(
    rawChunks.map((c) => c.text),
    config,
    progress,
    120_000,
  );

  const newChunks: IndexedSection[] = rawChunks.map((chunk, i) => ({
    skill: chunk.skill,
    file: chunk.file,
    section: chunk.section,
    text: chunk.text,
    embedding: embeddings[i],
  }));

  return [...cleanedChunks, ...newChunks];
}
