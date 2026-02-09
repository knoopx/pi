import { chunkMarkdown } from "./chunker";
import { getGlobalStore, resetGlobalStore } from "./store";

async function main() {
  console.log("Testing chunker...");

  const markdown = `# Test Document

This is a test paragraph with some content.

## Section 1

Content of section 1 with enough text to pass minimum size requirements.

## Section 2

Content of section 2 with more interesting content here.
`;

  const chunks = chunkMarkdown(markdown, "test.md", {
    minChunkSize: 20,
    groupByHeading: true,
  });

  console.log(`Created ${chunks.length} chunks`);

  console.log("\nTesting embeddings...");
  resetGlobalStore();
  const store = await getGlobalStore({
    onProgress: (msg) => console.log(`Progress: ${msg}`),
  });

  await store.addChunks(chunks);
  console.log(`Store now has ${store.size} chunks`);

  console.log("\nSearching...");
  const results = await store.search("section content", { limit: 2 });
  console.log(`Found ${results.length} results`);
  results.forEach((r, i) => {
    console.log(
      `Result ${i + 1}: ${(r.similarity * 100).toFixed(1)}% - ${r.chunk.content.slice(0, 40)}...`,
    );
  });

  console.log("\nTest completed successfully!");
}

main().catch(console.error);
