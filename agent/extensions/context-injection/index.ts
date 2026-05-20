import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SkillEntry } from "../../shared/skills-registry";
import { registry } from "../../shared/skills-registry";
import { buildSectionBlock } from "../../shared/block-builder";
import { predictTools, detectCliTools } from "./intent";

export interface ContextState {
  recentToolCalls: string[];
  lastFailedTool: string | null;
  sessionActive: boolean;
}

export function createContextState(): ContextState {
  return {
    recentToolCalls: [],
    lastFailedTool: null,
    sessionActive: false,
  };
}

export function updateRecency(state: ContextState, name: string): void {
  const idx = state.recentToolCalls.indexOf(name);
  if (idx !== -1) state.recentToolCalls.splice(idx, 1);
  state.recentToolCalls.unshift(name);
  if (state.recentToolCalls.length > 8) state.recentToolCalls.length = 8;
}

// ── Skill injection (tool usage guidance) ──────────────────────────────

export interface SelectionState {
  selected: SkillEntry[];
  used: number;
  tryAdd(name: string): void;
  tryAddEntry(entry: SkillEntry): void;
}

export function createSelectionState(
  budget: number,
  allowed?: Set<string>,
): SelectionState {
  const selected: SkillEntry[] = [];
  let used = 0;
  const tryAdd = (name: string): void => {
    let sk = registry.getByName(name);
    if (!sk) sk = registry.getByTool(name);
    if (!sk || selected.includes(sk)) return;
    if (allowed?.has(name) === false) return;
    if (used + sk.tokenCost > budget) return;
    selected.push(sk);
    used += sk.tokenCost;
  };
  const tryAddEntry = (entry: SkillEntry): void => {
    if (selected.includes(entry)) return;
    if (used + entry.tokenCost > budget) return;
    selected.push(entry);
    used += entry.tokenCost;
  };
  return {
    selected,
    get used() {
      return used;
    },
    tryAdd,
    tryAddEntry,
  };
}

function addRecencySkills(
  ctx: ContextState,
  state: SelectionState,
  budget: number,
): void {
  for (const name of ctx.recentToolCalls.slice(0, 4)) {
    if (state.used >= budget) break;
    state.tryAdd(name);
  }
}

function addIntentSkills(
  state: SelectionState,
  prompt: string,
  budget: number,
  activeTools: Set<string>,
): void {
  if (state.used >= budget) return;
  const toolSkills = registry.getToolEntries();
  for (const name of predictTools(prompt, toolSkills, activeTools)) {
    if (state.used >= budget) break;
    state.tryAdd(name);
  }
}

function addCliTools(
  state: SelectionState,
  prompt: string,
  budget: number,
): void {
  if (state.used >= budget) return;
  const toolSkills = registry.getToolEntries();
  const cliSkills = detectCliTools(prompt, toolSkills);
  for (const skill of cliSkills) {
    if (state.used >= budget) break;
    state.tryAddEntry(skill);
  }
}

function addRelatedSkills(state: SelectionState, budget: number): void {
  if (state.used >= budget) return;
  for (const entry of state.selected) {
    if (state.used >= budget) break;
    for (const related of registry.getRelated(entry)) {
      if (state.used >= budget) break;
      state.tryAddEntry(related);
    }
  }
}

function selectSkills(
  ctx: ContextState,
  prompt: string,
  budget: number,
  activeTools: Set<string>,
): SkillEntry[] {
  const selection = createSelectionState(budget);

  if (ctx.lastFailedTool) selection.tryAdd(ctx.lastFailedTool);
  addRecencySkills(ctx, selection, budget);
  addIntentSkills(selection, prompt, budget, activeTools);
  addCliTools(selection, prompt, budget);
  addRelatedSkills(selection, budget);

  return selection.selected;
}

// Keyword-triggered directive for research tasks
export const RESEARCH_TRIGGERS = [
  /\bbrows(?:e|ing|er)\b/i,
  /\bonline\b/i,
  /\bresearch(?:ing)?\b/i,
  /\blook\s+up\b/i,
  /\blookup\b/i,
  /\bsearch\s+(?:the|for)\b/i,
  /\bweb\s*search\b/i,
  /\bwikipedia\b/i,
  /\bwebsite\b/i,
  /\bweb\s*page\b/i,
  /\bgoogle\b/i,
  /\bcite|citation\b/i,
  /\bfact[-\s]?check/i,
];

export function looksLikeResearchTask(text: string): boolean {
  if (!text) return false;
  for (const re of RESEARCH_TRIGGERS) {
    if (re.test(text)) return true;
  }
  return false;
}

export const GATHER_KEYWORDS = [
  "navigate",
  "extract",
  "search",
  "fetch",
  "browse",
];

export function isGatherTool(tool: string): boolean {
  const lower = tool.toLowerCase();
  return GATHER_KEYWORDS.some((kw) => lower.includes(kw));
}

export function buildResearchDirective(activeTools: Set<string>): string {
  const gatherTools = [...activeTools].filter(isGatherTool);
  if (gatherTools.length === 0) return "";

  return [
    "",
    "## Research-first directive",
    "This task involves online research. Before producing a final answer:",
    `1. Use ${gatherTools.join(" / ")} to gather facts.`,
    activeTools.has("evidence-add")
      ? "2. Save each citable fact via evidence-add before relying on it."
      : "2. Save each citable fact before relying on it.",
    "3. Only after evidence is in place should you consider any Edit/Write tool calls.",
    "Skipping the gather step (going straight to Edit/Write or guessing from memory) is wrong — restart with the browse step instead.",
    "",
  ].join("\n");
}

function buildSkillBlock(selected: SkillEntry[]): string {
  return buildSectionBlock(
    "Tool Usage Guidance",
    selected.map((s) => ({
      heading: s.targetTool ? `${s.targetTool} (${s.name})` : s.name,
      body: s.body,
    })),
  );
}

// ── Knowledge injection (algorithm reference) ──────────────────────────

const MIN_SCORE_THRESHOLD = 2.0;
const KNOWLEDGE_TOKEN_BUDGET = 200;
const DEFAULT_CONTEXT_LIMIT = 8192;

interface KnowledgeEntry {
  topic: string;
  body: string;
  tokenCost: number;
  keywords: string[];
  requiresTools: string[];
  description: string;
}

export const PER_ENTRY_CAP = 150;

export function toKnowledgeEntry(e: SkillEntry): KnowledgeEntry {
  return {
    topic: e.topic,
    body: e.body,
    tokenCost: Math.min(e.tokenCost, PER_ENTRY_CAP),
    keywords: e.keywords,
    requiresTools: e.requiresTools,
    description: e.description,
  };
}

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

function scoreKnowledgeEntry(userText: string, e: KnowledgeEntry): number {
  let score = scoreKeywords(userText, e.keywords);
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

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function selectKnowledgeEntries(
  prompt: string,
  budget: number,
  activeTools: Set<string>,
): KnowledgeEntry[] {
  const entries = registry.getKnowledgeEntries().map(toKnowledgeEntry);
  const scored: Array<{ score: number; entry: KnowledgeEntry }> = [];

  for (const e of entries) {
    if (e.requiresTools.length > 0) {
      const missing = e.requiresTools.filter((t) => !activeTools.has(t));
      if (missing.length > 0) continue;
    }
    const s = scoreKnowledgeEntry(prompt, e);
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

function buildKnowledgeBlock(selected: KnowledgeEntry[]): string {
  return buildSectionBlock(
    "Algorithm Reference",
    selected.map((e) => ({ heading: e.topic, body: e.body })),
  );
}

// ── Extension registration ─────────────────────────────────────────────

const SKILL_TOKEN_BUDGET = 300;

export default function (pi: ExtensionAPI) {
  const state = createContextState();

  pi.on("session_start", async () => {
    state.sessionActive = true;
  });
  pi.on("session_shutdown", async () => {
    state.sessionActive = false;
    state.recentToolCalls.length = 0;
    state.lastFailedTool = null;
  });

  pi.on("tool_result", async (event) => {
    if (!state.sessionActive) return;
    const typed = event as {
      toolName?: string;
      name?: string;
      isError?: boolean;
    };
    const name = typed.toolName || typed.name;
    if (typeof name === "string") {
      updateRecency(state, name);
      state.lastFailedTool = typed.isError === true ? name : null;
    }
  });

  function buildInjectedPrompt(
    sessionActive: boolean,
    prompt: string,
    baseSystemPrompt: string,
    activeTools: Set<string>,
  ): string | null {
    if (registry.getTargetTools().length === 0) return null;

    const parts: string[] = [];
    const ctx: ContextState = {
      recentToolCalls: [],
      lastFailedTool: null,
      sessionActive,
    };
    const selectedSkills = selectSkills(
      ctx,
      prompt,
      SKILL_TOKEN_BUDGET,
      activeTools,
    );
    if (selectedSkills.length > 0) {
      parts.push(buildSkillBlock(selectedSkills));
    }

    const knowledgeEntries = selectKnowledgeEntries(
      prompt,
      KNOWLEDGE_TOKEN_BUDGET,
      activeTools,
    );
    if (knowledgeEntries.length > 0) {
      parts.push(buildKnowledgeBlock(knowledgeEntries));
    }

    if (looksLikeResearchTask(prompt)) {
      const directive = buildResearchDirective(activeTools);
      if (directive) parts.push(directive);
    }

    if (parts.length === 0) return null;
    return baseSystemPrompt + parts.join("\n");
  }

  pi.on("before_agent_start", async (event, ctx) => {
    if (!state.sessionActive) return;

    const typed = event as { prompt?: string; systemPrompt?: string };
    const prompt = typed.prompt ?? "";
    const base = typed.systemPrompt ?? "";
    const activeToolNames = pi.getActiveTools();
    const activeTools = new Set(activeToolNames);

    const injected = buildInjectedPrompt(
      state.sessionActive,
      prompt,
      base,
      activeTools,
    );
    if (!injected) return;

    return { systemPrompt: injected };
  });
}
