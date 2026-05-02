import { embedTexts } from "../../../shared/embeddings/engine";
import { loadConfig } from "../config";
import { loadIndex, printMatches } from "./shared";

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
