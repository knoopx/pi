import type {
  ExtensionAPI,
  InputEvent,
  SessionStartEvent,
} from "@mariozechner/pi-coding-agent";
import type { RawEntry } from "./file-index";
import { PathSuggesterFileIndex } from "./file-index";
import { loadConfig, type PathSuggesterConfig } from "./settings";
import { embedQuery } from "./embeddings";
import { scoreAndRank } from "./suggester";
import { formatSuggestions } from "./formatter";
import { finishEmbedding } from "../../shared/embeddings/progress";

async function initIndex(
  config: PathSuggesterConfig,
  projectDir: string,
): Promise<RawEntry[] | null> {
  try {
    return await PathSuggesterFileIndex.buildIndex(config, projectDir);
  } catch (err) {
    console.error("[path-suggester] Failed to build index:", err);
    return null;
  } finally {
    finishEmbedding();
  }
}

export default async function (pi: ExtensionAPI) {
  const config = await loadConfig();
  if (!config.enabled) return;

  let index: RawEntry[] | null = null;
  let projectDir: string | undefined;

  pi.on("session_start", async (_event: SessionStartEvent, ctx) => {
    projectDir = ctx.cwd;
    index = await initIndex(config, projectDir);
  });

  // Suggest related file paths for all user input
  pi.on("input", async (event: InputEvent, ctx) => {
    return await handleInput(pi, event, ctx, index, config);
  });
}

async function handleInput(
  pi: ExtensionAPI,
  event: InputEvent,
  ctx: { cwd: string },
  index: RawEntry[] | null,
  config: PathSuggesterConfig,
): Promise<{ action: "continue"; text: string; images?: unknown } | undefined> {
  const result = await resolveSuggestion(event, index, config, ctx.cwd);
  if (!result) return;

  pi.sendMessage({
    customType: "files",
    content: result.suggestion,
    display: true,
  });

  return buildResponse(result.suggestion, event.images);
}

function validateInput(
  event: InputEvent,
  index: RawEntry[] | null,
): string | null {
  const promptText = event.text?.trim();
  if (!promptText || !index?.length) return null;
  return promptText;
}

async function embedAndRank(
  index: RawEntry[] | null,
  promptText: string,
  config: PathSuggesterConfig,
  cwd: string,
): Promise<string | null> {
  if (!index) return null;

  const qEmbedding = await embedQuery(promptText, config);
  if (!qEmbedding) return null;

  const rankedHits = scoreAndRank(
    index,
    qEmbedding,
    { ...config, scoreThreshold: config.promptScoreThreshold },
    cwd,
  );
  if (rankedHits.length === 0) return null;

  return formatSuggestions(rankedHits);
}

async function resolveSuggestion(
  event: InputEvent,
  index: RawEntry[] | null,
  config: PathSuggesterConfig,
  cwd: string,
): Promise<{ suggestion: string } | null> {
  const promptText = validateInput(event, index);
  if (!promptText) return null;

  const suggestion = await embedAndRank(index, promptText, config, cwd);
  if (!suggestion) return null;

  return { suggestion };
}

function buildResponse(
  suggestion: string,
  images?: unknown,
): { action: "continue"; text: string; images?: unknown } {
  return { action: "continue" as const, text: suggestion, images };
}
