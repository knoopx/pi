import { relative, resolve } from "node:path";
import { embedQuery, cosine } from "../../shared/embeddings/engine";
import { loadConfig, type PathSuggesterConfig } from "./settings";
import { PathSuggesterFileIndex } from "./file-index";
import type { RawEntry } from "./file-index";

interface FileHit {
  score: number;
  path: string;
  relPath: string;
  symbols: string;
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
  const index = await PathSuggesterFileIndex.buildIndex(config, projectDir);

  console.log(`Query: "${query}"`);
  console.log(`Threshold: ${config.promptScoreThreshold}\n`);

  const embedding = await embedQuery(query, config, {
    message: "Embedding query...",
  });
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
