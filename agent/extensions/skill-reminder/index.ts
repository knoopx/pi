import type {
  ExtensionAPI,
  InputEvent,
  ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import { build } from "./indexer";
import { loadConfig, type Config } from "./config";
import type { IndexedSection } from "../../shared/indexing/cache";
import type { ProgressState } from "../../shared/embeddings/progress";
import { embedQuery } from "../../shared/embeddings/engine";
import { buildQuery, extractPromptText } from "./query-builder";
import { scoreAndRank } from "./scorer";
import { formatHits, buildReminder } from "./reminder";
import { isTextContent } from "../../shared/guards";
import { finishEmbedding } from "../../shared/embeddings/progress";

async function buildIndex(config: Config): Promise<IndexedSection[] | null> {
  try {
    return await build(config);
  } catch (err) {
    console.error("[skill-reminder] Failed to build index:", err);
    return null;
  } finally {
    finishEmbedding();
  }
}

function appendReminder(
  content: Array<{ type?: string; text?: string }> | undefined,
  reminder: string,
): typeof content {
  const existing = content ?? [];
  const lastItem = existing[existing.length - 1];

  if (isTextContent(lastItem)) {
    lastItem.text += "\n" + reminder;
  } else {
    existing.push({ type: "text", text: reminder });
  }

  return existing;
}

export default async function (pi: ExtensionAPI) {
  const config = await loadConfig();
  if (!config.enabled) return;

  const index = await buildIndex(config);
  if (!index?.length) return;

  // TS can't resolve the overload with 28+ event types; handler is correct at runtime.
  // @ts-expect-error overload resolution limitation
  pi.on("tool_result", async (event: ToolResultEvent, _ctx) => {
    if (!event.isError) return;

    const query = buildQuery(event);
    const progress: ProgressState = { message: "Searching skills..." };
    const qEmbedding = await embedQuery(query, config, progress);
    if (!qEmbedding) return;

    const rankedHits = scoreAndRank(index, qEmbedding, config, query);
    if (rankedHits.length === 0) return;

    const reminder = buildReminder(rankedHits);
    const content = appendReminder(event.content, reminder);
    return { content };
  });

  // Surface relevant skills for all user input, including steering and follow-up
  // messages during streaming (before_agent_start does not fire for those).
  pi.on("input", async (event: InputEvent, _ctx) => {
    const promptText = extractPromptText(event.text, event.images);
    if (!promptText) return;

    const progress: ProgressState = { message: "Searching skills..." };
    const qEmbedding = await embedQuery(promptText, config, progress);
    if (!qEmbedding) return;

    const rankedHits = scoreAndRank(
      index,
      qEmbedding,
      { ...config, scoreThreshold: config.promptScoreThreshold },
      promptText,
    );
    if (rankedHits.length === 0) return;

    const reminder = formatHits(rankedHits);

    pi.sendMessage({ customType: "skills", content: reminder, display: true });

    return {
      action: "continue" as const,
      text: reminder,
      images: event.images,
    };
  });
}
