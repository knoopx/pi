import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SkillEntry } from "../../shared/skills-registry";
import { registry } from "../../shared/skills-registry";
import { predictTools, detectCliTools } from "./intent";
import { buildSectionBlock } from "../../shared/block-builder";

// Hooks `before_agent_start` to append a `## Tool Usage Guidance` block to
// the system prompt. Per-user-prompt selection using the whitepaper's
// 3-priority algorithm (error recovery > recency > intent). Budget-guarded,
// cached. Uses the shared skill registry.

const selectionCache = new Map<string, string>();

// State tracked across the session so we have error-recovery + recency
// signals by the time the next `before_agent_start` fires.
const recentToolCalls: string[] = []; // most-recent-first, capped at 8
let lastFailedTool: string | null = null;

interface SelectionState {
  selected: SkillEntry[];
  used: number;
  tryAdd(name: string): void;
  tryAddEntry(entry: SkillEntry): void;
}

function createSelectionState(
  budget: number,
  allowed?: Set<string>,
): SelectionState {
  const selected: SkillEntry[] = [];
  let used = 0;
  const tryAdd = (name: string): void => {
    // Try by skill name first (predictTools returns skill names), then by tool name
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
  return { selected, used, tryAdd, tryAddEntry };
}

function addRecencySkills(state: SelectionState, budget: number): void {
  for (const name of recentToolCalls.slice(0, 4)) {
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
    if (state.selected.includes(skill)) continue;
    state.selected.push(skill);
    state.used += skill.tokenCost;
  }
}

function selectSkills(
  prompt: string,
  budget: number,
  activeTools: Set<string>,
  allowed?: Set<string>,
): SkillEntry[] {
  const state = createSelectionState(budget, allowed);

  if (lastFailedTool) state.tryAdd(lastFailedTool);
  addRecencySkills(state, budget);
  addIntentSkills(state, prompt, budget, activeTools);
  addCliTools(state, prompt, budget);
  addRelatedSkills(state, budget);

  return state.selected;
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

function buildBlock(selected: SkillEntry[]): string {
  return buildSectionBlock(
    "Tool Usage Guidance",
    selected.map((s) => ({
      heading: s.targetTool ? `${s.targetTool} (${s.name})` : s.name,
      body: s.body,
    })),
  );
}

// Keyword-triggered directive: when the user's prompt smells like a
// research / web-lookup task, prepend an explicit "browse-first, then
// edit-write" rule. Without it, qwen-class small models often skip
// straight to Edit/Write on free-form questions, never gathering evidence.
const RESEARCH_TRIGGERS = [
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

function looksLikeResearchTask(text: string): boolean {
  if (!text) return false;
  for (const re of RESEARCH_TRIGGERS) {
    if (re.test(text)) return true;
  }
  return false;
}

const GATHER_KEYWORDS = ["navigate", "extract", "search", "fetch", "browse"];

function isGatherTool(tool: string): boolean {
  const lower = tool.toLowerCase();
  return GATHER_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildResearchDirective(activeTools: Set<string>): string {
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

function getOrCreateBlock(selected: SkillEntry[]): string {
  const key = selected
    .map((s) => s.name)
    .sort()
    .join("|");
  let block = selectionCache.get(key);
  if (block === undefined) {
    block = buildBlock(selected);
    selectionCache.set(key, block);
  }
  return block;
}

function buildNotifyParts(
  selected: SkillEntry[],
  researchTask: boolean,
): string {
  const parts: string[] = [];
  if (selected.length > 0) {
    parts.push(
      `+${selected.length} [${selected.map((s) => s.targetTool ?? s.name).join(",")}]`,
    );
  }
  if (researchTask) parts.push("+research-directive");
  return parts.join(" ");
}

export default function (pi: ExtensionAPI) {
  let sessionActive = false;

  pi.on("session_start", async () => {
    sessionActive = true;
  });
  pi.on("session_shutdown", async () => {
    sessionActive = false;
    recentToolCalls.length = 0;
    lastFailedTool = null;
  });

  function updateRecency(name: string): void {
    const idx = recentToolCalls.indexOf(name);
    if (idx !== -1) recentToolCalls.splice(idx, 1);
    recentToolCalls.unshift(name);
    if (recentToolCalls.length > 8) recentToolCalls.length = 8;
  }

  // Track tool usage across the whole session so recency + error-recovery
  // state is available on the next before_agent_start.
  pi.on("tool_result", async (event) => {
    if (!sessionActive) return;
    const typed = event as {
      toolName?: string;
      name?: string;
      isError?: boolean;
    };
    const name = typed.toolName || typed.name;
    if (typeof name === "string") {
      updateRecency(name);
      lastFailedTool = typed.isError === true ? name : null;
    }
  });

  const SKILL_TOKEN_BUDGET = 300;

  function notifySkillInject(
    ctx: { ui: { notify(msg: string, type: string): void } },
    selected: SkillEntry[],
    researchTask: boolean,
  ): void {
    try {
      ctx.ui.notify(
        `skill-inject: ${buildNotifyParts(selected, researchTask)}`,
        "info",
      );
    } catch {
      // UI unavailable in some run modes — silent best-effort
    }
  }

  pi.on("before_agent_start", async (event, ctx) => {
    if (!sessionActive) return;
    if (registry.getTargetTools().length === 0) return;

    const typed = event as { prompt?: string; systemPrompt?: string };
    const prompt = typed.prompt ?? "";
    const activeToolNames = pi.getActiveTools();
    const activeTools = new Set(activeToolNames);
    const selected = selectSkills(prompt, SKILL_TOKEN_BUDGET, activeTools);
    const researchTask = looksLikeResearchTask(prompt);

    if (selected.length === 0 && !researchTask) return;

    notifySkillInject(
      ctx as { ui: { notify(msg: string, type: string): void } },
      selected,
      researchTask,
    );

    const skillBlock = buildBlock(selected);
    const directive = researchTask ? buildResearchDirective(activeTools) : "";
    const base = typed.systemPrompt ?? "";

    return { systemPrompt: base + skillBlock + directive };
  });
}
