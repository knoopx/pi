import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildSectionBlock } from "../../shared/block-builder";
import { registry, type SkillEntry } from "../../shared/skills-registry";

const cache = new Map<string, string>();

const MIN_SCORE_THRESHOLD = 2.0;
const PER_ENTRY_CAP = 150;

// Adapter: SkillEntry -> knowledge entry with capped token cost
function toKnowledgeEntry(e: SkillEntry): KnowledgeEntry {
  return {
    topic: e.topic,
    body: e.body,
    tokenCost: Math.min(e.tokenCost, PER_ENTRY_CAP),
    keywords: e.keywords,
    requiresTools: e.requiresTools,
    related: e.related,
    description: e.description,
  };
}

interface KnowledgeEntry {
  topic: string;
  body: string;
  tokenCost: number;
  keywords: string[];
  requiresTools: string[];
  related: string[];
  description: string;
}

function loadEntries(): KnowledgeEntry[] {
  return registry.getKnowledgeEntries().map(toKnowledgeEntry);
}

// ── Scoring (word=1.0, bigram/phrase=2.0) ───────────────────────────────
export function scoreKeywords(userText: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const textLower = userText.toLowerCase();
  const words = new Set(textLower.split(/\s+/).filter(Boolean));
  let score = 0;
  for (const kw of keywords) {
    if (kw.includes(" ")) {
      if (textLower.includes(kw)) score += 2.0;
    } else {
      if (words.has(kw)) score += 1.0;
    }
  }
  return score;
}

function scoreEntry(userText: string, e: KnowledgeEntry): number {
  let score = scoreKeywords(userText, e.keywords);
  // Also score against description for additional semantic signals
  if (e.description) {
    const descWords = new Set(
      e.description.toLowerCase().split(/\s+/).filter(Boolean),
    );
    const promptWords = new Set(
      userText.toLowerCase().split(/\s+/).filter(Boolean),
    );
    for (const word of promptWords) {
      if (word.length > 3 && descWords.has(word)) {
        score += 0.5;
      }
    }
  }
  return score;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function buildBlock(selected: KnowledgeEntry[]): string {
  return buildSectionBlock(
    "Algorithm Reference",
    selected.map((e) => ({ heading: e.topic, body: e.body })),
  );
}

function scoreAndSelect(
  prompt: string,
  budget: number,
  activeTools: Set<string>,
): KnowledgeEntry[] {
  const entries = loadEntries();
  const scored: Array<{ score: number; entry: KnowledgeEntry }> = [];

  for (const e of entries) {
    if (e.requiresTools.length > 0) {
      const missing = e.requiresTools.filter((t) => !activeTools.has(t));
      if (missing.length > 0) continue;
    }
    const s = scoreEntry(prompt, e);
    if (s >= MIN_SCORE_THRESHOLD) scored.push({ score: s, entry: e });
  }
  if (scored.length === 0) return [];
  scored.sort((a, b) => b.score - a.score);

  const selected: KnowledgeEntry[] = [];
  let used = 0;
  for (const { entry } of scored) {
    if (used + entry.tokenCost > budget) continue;
    selected.push(entry);
    used += entry.tokenCost;
  }
  return selected;
}

function getOrCreateBlock(selected: KnowledgeEntry[]): string {
  const key = selected
    .map((e) => e.topic)
    .sort()
    .join("|");
  let block = cache.get(key);
  if (block === undefined) {
    block = buildBlock(selected);
    cache.set(key, block);
  }
  return block;
}

const KNOWLEDGE_TOKEN_BUDGET = 200;
const DEFAULT_CONTEXT_LIMIT = 8192;

function notifyKnowledgeInject(
  ctx: { ui: { notify(msg: string, type: string): void } },
  selected: KnowledgeEntry[],
): void {
  try {
    ctx.ui.notify(
      `knowledge-inject: +${selected.length} [${selected.map((e) => e.topic).join(",")}]`,
      "info",
    );
  } catch {
    // best-effort
  }
}

function handleKnowledgeInject(
  event: Record<string, unknown>,
  ctx: { ui: { notify(msg: string, type: string): void } },
  activeTools: Set<string>,
): { systemPrompt: string } | undefined {
  const base = (event.systemPrompt as string) ?? "";
  if (estimateTokens(base) > DEFAULT_CONTEXT_LIMIT * 0.4) return;

  const prompt = (event.prompt as string) ?? "";
  if (!prompt) return;

  const selected = scoreAndSelect(prompt, KNOWLEDGE_TOKEN_BUDGET, activeTools);
  if (selected.length === 0) return;

  notifyKnowledgeInject(ctx, selected);

  return { systemPrompt: base + getOrCreateBlock(selected) };
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const activeToolNames = pi.getActiveTools();
    const activeTools = new Set(activeToolNames);
    return handleKnowledgeInject(
      event as unknown as Record<string, unknown>,
      ctx as { ui: { notify(msg: string, type: string): void } },
      activeTools,
    );
  });
}
