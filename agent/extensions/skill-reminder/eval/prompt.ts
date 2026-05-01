import type { IndexedChunk } from "../cache";
import { loadCache } from "../cache";
import { embedTexts, cosine } from "../embeddings";
import { loadConfig } from "../settings";

async function loadIndex(): Promise<IndexedChunk[]> {
  const cached = await loadCache();
  if (!cached) {
    console.log("Cache not found, building index...");
    const { buildIndex } = await import("../index-builder");
    const config = await loadConfig();
    return await buildIndex(config);
  }

  const skillCount = new Set(cached.chunks.map((c) => c.skill)).size;
  console.log(
    `Loaded ${cached.chunks.length} chunks across ${skillCount} skills`,
  );
  return cached.chunks;
}

function printMatches(index: IndexedChunk[], embedding: number[]) {
  const scored = index
    .map((chunk) => ({
      skill: chunk.skill,
      file: chunk.file,
      section: chunk.section,
      score: cosine(embedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  console.log("=== Top-10 Matches ===\n");
  for (const s of scored.slice(0, 10)) {
    console.log(
      `${s.skill.padEnd(20)} ${s.score.toFixed(4)}  ${s.file} → ${s.section}`,
    );
  }
}

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ");

  if (!prompt) {
    console.error('Usage: bun run eval/prompt.ts "your query text"');
    process.exit(1);
  }

  const config = await loadConfig();
  const index = await loadIndex();

  console.log(`Query: "${prompt}"\n`);

  const embedding = (await embedTexts([prompt], config))[0];
  printMatches(index, embedding);
}

main().catch(console.error);
