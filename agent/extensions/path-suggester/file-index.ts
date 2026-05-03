import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadPathSuggesterCache, savePathSuggesterCache } from "./cache";
import type { ProgressState } from "../../shared/embeddings/progress";
import { embedTexts } from "./embeddings";
import type { PathSuggesterConfig } from "./settings";
import { buildFileList, buildSymbolText, CmEntry } from "./path-utils";

const CONCURRENCY_LIMIT = 20;

function fileDigest(entry: CmEntry): string {
  return createHash("sha256")
    .update(`${entry.path}|${entry.symbols}`)
    .digest("hex");
}

export interface RawEntry {
  path: string;
  contentSnippet: string;
  symbolText: string;
  embedding: number[];
}

async function readContentSnippet(path: string): Promise<string> {
  try {
    const content = await readFile(path, "utf-8");
    return content.slice(0, 700);
  } catch {
    return path;
  }
}

async function readInBatches(paths: string[]): Promise<string[]> {
  const results: string[] = new Array(paths.length);
  let nextIndex = 0;

  const workers = Array.from({ length: CONCURRENCY_LIMIT }, async () => {
    while (nextIndex < paths.length) {
      const i = nextIndex++;
      results[i] = await readContentSnippet(paths[i]);
    }
  });

  await Promise.all(workers);
  return results;
}

export const PathSuggesterFileIndex = {
  async buildIndex(
    config: PathSuggesterConfig,
    projectDir: string,
  ): Promise<RawEntry[]> {
    const cmEntries = await buildFileList(projectDir);
    if (cmEntries.length === 0) return [];

    const currentDigests = new Map(
      cmEntries.map((e) => [e.path, fileDigest(e)]),
    );

    const cached = await loadPathSuggesterCache();
    const { unchanged, stale } = filterByDigest(cmEntries, cached?.digests);

    // Remove entries for deleted files
    const currentPaths = new Set(currentDigests.keys());
    const cleanedChunks =
      (cached?.chunks as RawEntry[]).filter((entry) =>
        currentPaths.has(entry.path),
      ) ?? [];

    let allEntries: RawEntry[] = [...cleanedChunks, ...unchanged];

    if (stale.length > 0 || unchanged.length < cmEntries.length) {
      allEntries = await rebuildAndMerge(
        cmEntries,
        cleanedChunks,
        unchanged,
        config,
      );
    }

    const newDigests = Object.fromEntries(currentDigests.entries());
    await savePathSuggesterCache({ digests: newDigests, chunks: allEntries });

    return allEntries;
  },
};

function filterByDigest(
  cmEntries: CmEntry[],
  cachedDigests?: Record<string, string>,
): { unchanged: RawEntry[]; stale: CmEntry[] } {
  if (!cachedDigests) return { unchanged: [], stale: [] };

  const unchanged: RawEntry[] = [];
  const stale: CmEntry[] = [];

  for (const entry of cmEntries) {
    if (cachedDigests[entry.path] === fileDigest(entry)) {
      unchanged.push({
        path: entry.path,
        contentSnippet: "",
        symbolText: "",
        embedding: [],
      });
    } else {
      stale.push(entry);
    }
  }

  return { unchanged, stale };
}

async function rebuildAndMerge(
  allCmEntries: CmEntry[],
  cachedChunks: RawEntry[],
  unchanged: RawEntry[],
  config: PathSuggesterConfig,
): Promise<RawEntry[]> {
  const unchangedPaths = new Set(unchanged.map((e) => e.path));

  const rebuildEntries = allCmEntries.filter(
    (e) => !unchangedPaths.has(e.path),
  );

  if (rebuildEntries.length === 0) {
    return cachedChunks;
  }

  const paths = rebuildEntries.map((e) => e.path);
  const snippets = await readInBatches(paths);

  const symbolTexts: string[] = [];
  const symbolPaths: string[] = [];
  for (let i = 0; i < rebuildEntries.length; i++) {
    const symText = buildSymbolText(rebuildEntries[i]);
    if (symText && symText.length > 5) {
      symbolTexts.push(symText);
      symbolPaths.push(paths[i]);
    }
  }

  const allTexts = [...snippets, ...symbolTexts];
  const progress: ProgressState = { message: "Indexing files..." };
  const embeddings = await embedTexts(allTexts, config, progress, 120_000);

  const newEntries: RawEntry[] = [];
  for (let i = 0; i < rebuildEntries.length; i++) {
    newEntries.push({
      path: paths[i],
      contentSnippet: snippets[i],
      symbolText: "",
      embedding: embeddings[i],
    });
  }
  for (let i = 0; i < symbolTexts.length; i++) {
    newEntries.push({
      path: symbolPaths[i],
      contentSnippet: "",
      symbolText: symbolTexts[i],
      embedding: embeddings[snippets.length + i],
    });
  }

  return [...cachedChunks, ...newEntries];
}
