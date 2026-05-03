import { relative, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import {
  loadPathSuggesterCache as loadCache,
  savePathSuggesterCache as saveCache,
} from "./cache";
import { embedQuery, cosine, embedTexts } from "../../shared/embeddings/engine";
import { loadConfig, type PathSuggesterConfig } from "./settings";
import { buildFileList, buildSymbolText } from "./path-utils";

interface RawEntry {
  path: string;
  contentSnippet: string;
  symbolText: string;
  embedding: number[];
}

interface FileHit {
  score: number;
  path: string;
  relPath: string;
  symbols: string;
}

async function loadIndex(projectDir: string): Promise<RawEntry[]> {
  const cached = await loadCache();
  if (cached) {
    console.log(`Loaded ${cached.chunks.length} entries`);
    return cached.chunks as RawEntry[];
  }

  console.log("Cache not found, building index...");
  const cmEntries = await buildFileList(projectDir);
  if (cmEntries.length === 0) return [];

  const absEntries = cmEntries.map((e) => ({
    path: resolve(e.path),
    lang: e.lang,
    symbolsCount: e.symbolsCount,
    symbols: e.symbols,
  }));

  const { snippets, symbolEntries } = await collectSnippetsAndSymbols(
    [] as typeof absEntries,
  );

  const config = await loadConfig();
  const allTexts = [...snippets, ...symbolEntries.map((e) => e.text)];
  const embeddings = await embedTexts(allTexts, config, 120_000);

  const entries = buildRawEntries(
    absEntries,
    snippets,
    symbolEntries,
    embeddings,
  );

  const mtimes = await collectMtimes(absEntries);
  await saveCache({ mtimes, chunks: entries });
  console.log(`Indexed ${entries.length} entries`);
  return entries;
}

async function collectSnippetsAndSymbols(
  absEntries: Array<{
    path: string;
    lang: string;
    symbolsCount: number;
    symbols: string;
  }>,
): Promise<{
  snippets: string[];
  symbolEntries: { path: string; text: string }[];
}> {
  const snippets: string[] = [];
  const symbolEntries: { path: string; text: string }[] = [];

  for (const entry of absEntries) {
    snippets.push(await readContentSnippet(entry.path));
    const symText = buildSymbolText(
      entry as unknown as Parameters<typeof buildSymbolText>[0],
    );
    if (symText && symText.length > 5) {
      symbolEntries.push({ path: entry.path, text: symText });
    }
  }

  return { snippets, symbolEntries };
}

function buildRawEntries(
  absEntries: Array<{ path: string }>,
  snippets: string[],
  symbolEntries: { path: string; text: string }[],
  embeddings: number[][],
): RawEntry[] {
  const entries: RawEntry[] = [];

  for (let i = 0; i < absEntries.length; i++) {
    entries.push({
      path: absEntries[i].path,
      contentSnippet: snippets[i],
      symbolText: "",
      embedding: embeddings[i],
    });
  }

  for (let i = 0; i < symbolEntries.length; i++) {
    entries.push({
      path: symbolEntries[i].path,
      contentSnippet: "",
      symbolText: symbolEntries[i].text,
      embedding: embeddings[absEntries.length + i],
    });
  }

  return entries;
}

async function collectMtimes(
  absEntries: Array<{ path: string }>,
): Promise<Record<string, number>> {
  const mtimes: Record<string, number> = {};
  for (const entry of absEntries) {
    try {
      const s = await stat(entry.path);
      mtimes[entry.path] = s.mtimeMs;
    } catch {}
  }
  return mtimes;
}

async function readContentSnippet(path: string): Promise<string> {
  try {
    const content = await readFile(path, "utf-8");
    return content.slice(0, 700);
  } catch {
    return path;
  }
}

function scoreAndRank(
  index: RawEntry[],
  queryEmbedding: number[],
  config: PathSuggesterConfig,
  projectDir: string,
): FileHit[] {
  const { fileScores, fileSymbols } = aggregateScores(
    index,
    queryEmbedding,
    config,
  );

  const scored = buildFileHits(fileScores, fileSymbols, projectDir);

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((h) => h.score >= config.scoreThreshold)
    .slice(0, config.maxSuggestions);
}

function aggregateScores(
  index: RawEntry[],
  queryEmbedding: number[],
  config: PathSuggesterConfig,
): { fileScores: Map<string, number>; fileSymbols: Map<string, string> } {
  const fileScores = new Map<string, number>();
  const fileSymbols = new Map<string, string>();

  for (const entry of index) {
    const score = cosine(queryEmbedding, entry.embedding);
    updateBestScore(fileScores, entry.path, score);
    if (entry.symbolText && score >= config.scoreThreshold) {
      appendSymbol(fileSymbols, entry.path, entry.symbolText);
    }
  }

  return { fileScores, fileSymbols };
}

function updateBestScore(
  scores: Map<string, number>,
  path: string,
  score: number,
): void {
  const existing = scores.get(path);
  if (existing === undefined || score > existing) {
    scores.set(path, score);
  }
}

function appendSymbol(
  symbols: Map<string, string>,
  path: string,
  symbolText: string,
): void {
  const existing = symbols.get(path);
  if (!existing) {
    symbols.set(path, symbolText);
  } else {
    symbols.set(path, `${existing}, ${symbolText}`);
  }
}

function buildFileHits(
  fileScores: Map<string, number>,
  fileSymbols: Map<string, string>,
  projectDir: string,
): FileHit[] {
  const scored: FileHit[] = [];
  for (const [path, score] of fileScores) {
    scored.push({
      score,
      path,
      relPath: relative(projectDir, path),
      symbols: fileSymbols.get(path) ?? "",
    });
  }
  return scored;
}

function formatSuggestions(hits: FileHit[]): void {
  for (const h of hits) {
    console.log(`${h.relPath} (${(h.score * 100).toFixed(0)}%)`);
    if (h.symbols) {
      for (const s of h.symbols.split(", ")) {
        console.log(`    ${s}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const { query, projectDir } = parseArgs();
  const config = await loadConfig();
  const index = await loadIndex(projectDir);

  console.log(`Query: "${query}"`);
  console.log(`Threshold: ${config.promptScoreThreshold}\n`);

  const embedding = await embedQuery(query, config);
  if (!embedding) {
    console.error("Failed to embed query.");
    process.exit(1);
  }

  const hits = scoreAndRank(index, embedding, config, projectDir);
  if (hits.length === 0) {
    console.log("(no matches above threshold)\n");
    return;
  }

  formatSuggestions(hits);
}

function parseArgs(): { query: string; projectDir: string } {
  const args = process.argv.slice(2);
  const query = args[0];
  if (!query) {
    console.error('Usage: bun run eval.ts "your query text" [project-dir]');
    process.exit(1);
  }
  return { query, projectDir: resolve(args[1] ?? ".") };
}

main().catch(console.error);
