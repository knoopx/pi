import { stat } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadCache, saveCache } from "./cache";
import { isCacheStale } from "../../shared/cache/cache-helpers";
import { embedTexts } from "./embeddings";
import type { PathSuggesterConfig } from "./settings";
import { buildFileList, buildSymbolText, CmEntry } from "./path-utils";

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

export const PathSuggesterFileIndex = {
  async buildIndex(
    config: PathSuggesterConfig,
    projectDir: string,
  ): Promise<RawEntry[]> {
    const cmEntries = await buildFileList(projectDir);

    // Normalize paths to absolute form for consistent cache comparison
    const absEntries = cmEntries.map((e) => ({
      ...e,
      path: resolve(e.path),
    }));

    // Check cache
    try {
      const cached = await loadCache();
      if (
        cached &&
        !(await isCacheStale(
          cached.mtimes,
          absEntries.map((e) => e.path),
        ))
      ) {
        return cached.chunks as RawEntry[];
      }
    } catch {
      // cache miss, continue
    }

    return embedAndSave(absEntries, config);
  },
};

async function embedAndSave(
  cmEntries: CmEntry[],
  config: PathSuggesterConfig,
): Promise<RawEntry[]> {
  const snippets: string[] = [];
  const symbolTexts: string[] = [];
  const paths: string[] = [];

  for (const entry of cmEntries) {
    const snippet = await readContentSnippet(entry.path);
    const symText = buildSymbolText(entry);
    snippets.push(snippet);
    if (symText && symText.length > 5) {
      symbolTexts.push(symText);
      paths.push(entry.path);
    }
    paths.push(entry.path);
  }

  const allTexts = [...snippets, ...symbolTexts];
  const embeddings = await embedTexts(allTexts, config, 120_000);

  const entries: RawEntry[] = [];
  for (let i = 0; i < cmEntries.length; i++) {
    const entry = cmEntries[i];
    entries.push({
      path: entry.path,
      contentSnippet: snippets[i],
      symbolText: "",
      embedding: embeddings[i],
    });
  }
  for (let i = 0; i < paths.length - cmEntries.length; i++) {
    const fileIdx = i;
    entries.push({
      path: paths[cmEntries.length + fileIdx],
      contentSnippet: "",
      symbolText: symbolTexts[fileIdx],
      embedding: embeddings[cmEntries.length + fileIdx],
    });
  }

  const mtimes: Record<string, number> = {};
  for (const entry of cmEntries) {
    try {
      const s = await stat(entry.path);
      mtimes[entry.path] = s.mtimeMs;
    } catch {
      // skip inaccessible files
    }
  }

  await saveCache({ mtimes, chunks: entries });
  return entries;
}
