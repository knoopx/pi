import type {
  ExtensionAPI,
  InputEvent,
  ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import type { IndexedChunk } from "./cache";
import type { BuildIndexProgress } from "./index-builder";
import { loadConfig, type SkillReminderConfig } from "./settings";
import { buildIndex } from "./index-builder";
import { embedQuery } from "./embeddings";
import { buildQuery, extractPromptText } from "./query";
import { scoreAndRank } from "./rag";
import { buildReminder, formatHits } from "./formatter";
import { isTextContent } from "./guards";
import { finish, renderEmbedding } from "./progress";

async function initIndex(
  config: SkillReminderConfig,
): Promise<IndexedChunk[] | null> {
  const progress: BuildIndexProgress = {
    onEmbedBatch: renderEmbedding,
  };

  try {
    return await buildIndex(config, progress);
  } catch (err) {
    console.error("[skill-reminder] Failed to build index:", err);
    return null;
  } finally {
    finish();
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

  const index = await initIndex(config);
  if (!index?.length) return;

  // TS can't resolve the overload with 28+ event types; handler is correct at runtime.
  // @ts-expect-error overload resolution limitation
  pi.on("tool_result", async (event: ToolResultEvent, _ctx) => {
    if (!event.isError) return;

    const query = buildQuery(event);
    const qEmbedding = await embedQuery(query, config);
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

    const qEmbedding = await embedQuery(promptText, config);
    if (!qEmbedding) return;

    const rankedHits = scoreAndRank(
      index,
      qEmbedding,
      { ...config, scoreThreshold: config.promptScoreThreshold },
      promptText,
    );
    if (rankedHits.length === 0) return;

    const reminder = formatHits(rankedHits);

    // pi.sendMessage({ content: reminder });
    pi.sendMessage(
      { customType: "skills", content: reminder, display: true },
      // { triggerTurn: false },
    );

    return {
      action: "continue" as const,
      text: reminder,
      images: event.images,
    };
  });
}
