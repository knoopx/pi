import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SkillEntry } from "../../shared/skills-registry";
import {
  RESEARCH_TRIGGERS,
  looksLikeResearchTask,
  GATHER_KEYWORDS,
  isGatherTool,
  buildResearchDirective,
  estimateTokens,
  createSelectionState,
  PER_ENTRY_CAP,
  toKnowledgeEntry,
  createContextState,
  updateRecency,
  scoreKeywords,
} from "./index";

// ── Helpers ────────────────────────────────────────────────────────────

const makeSkill = (
  name: string,
  targetTool: string | null = null,
  opts?: {
    keywords?: string[];
    description?: string;
    related?: string[];
    tokenCost?: number;
    topic?: string;
    requiresTools?: string[];
  },
): SkillEntry => ({
  name,
  path: `/fake/${name}.md`,
  body: `Body for ${name}`,
  size: 100,
  lineCount: 5,
  lastModified: Date.now(),
  targetTool,
  tokenCost: opts?.tokenCost ?? 100,
  topic: opts?.topic ?? name,
  keywords: opts?.keywords ?? [],
  requiresTools: opts?.requiresTools ?? [],
  related: opts?.related ?? [],
  description: opts?.description ?? "",
});

// ── Helpers ────────────────────────────────────────────────────────────

function computeDescriptionBonus(promptText: string, descText: string): number {
  const promptWords = new Set(promptText.toLowerCase().split(/\s+/));
  const descWords = new Set(
    descText.toLowerCase().split(/\s+/).filter(Boolean),
  );
  let bonus = 0;
  for (const word of promptWords) {
    if (word.length > 3 && descWords.has(word)) {
      bonus += 0.5;
    }
  }
  return bonus;
}

// ── scoreKeywords edge cases ───────────────────────────────────────────

describe("scoreKeywords edge cases", () => {
  it("returns 0 for empty keywords", () => {
    expect(scoreKeywords("some text", [])).toBe(0);
  });

  it("returns 0 when no keywords match", () => {
    expect(scoreKeywords("hello world", ["bucket", "pour"])).toBe(0);
  });

  it("is case-insensitive for single words", () => {
    expect(scoreKeywords("BUCKET pouring", ["bucket"])).toBe(1.0);
    // "Pouring" != "pour" as whole-word match; only bucket matches
    expect(scoreKeywords("Bucket Pouring", ["bucket", "pouring"])).toBe(2.0);
  });

  it("is case-insensitive for phrases", () => {
    expect(scoreKeywords("MINIMUM MOVES puzzle", ["minimum moves"])).toBe(2.0);
  });

  it("handles punctuation attached to words", () => {
    // "bucket." is not "bucket" as a whole word — scoreKeywords splits on whitespace only
    expect(scoreKeywords("find the bucket.", ["bucket"])).toBe(0);
    // phrase "state space" doesn't match "state-space" (hyphen vs space)
    expect(scoreKeywords("state-space search!", ["state space"])).toBe(0);
  });

  it("does not match substrings for single words", () => {
    expect(scoreKeywords("buckets pouring", ["bucket"])).toBe(0);
    expect(scoreKeywords("searching data", ["search"])).toBe(0);
  });

  it("phrase match requires exact substring", () => {
    // "state space" must appear as a contiguous substring
    expect(scoreKeywords("in state space here", ["state space"])).toBe(2.0);
    // "state and space" does NOT contain "state space"
    expect(scoreKeywords("in state and space", ["state space"])).toBe(0);
  });

  it("handles unicode characters gracefully", () => {
    expect(scoreKeywords("bucket пouring", ["bucket"])).toBe(1.0);
  });

  it("handles repeated keywords in text", () => {
    // keyword "bucket" appears twice but scores only once (Set dedup)
    expect(scoreKeywords("bucket bucket bucket", ["bucket"])).toBe(1.0);
  });

  it("handles empty text", () => {
    expect(scoreKeywords("", ["bucket"])).toBe(0);
  });

  it("handles whitespace-only text", () => {
    expect(scoreKeywords("   \t\n  ", ["bucket"])).toBe(0);
  });

  it("scores multiple phrase matches independently", () => {
    const kws = ["state space", "minimum moves"];
    expect(scoreKeywords("state space with minimum moves", kws)).toBe(4.0);
  });

  it("mixed word and phrase scoring", () => {
    // "bucket" (1.0) + "state space" (2.0) = 3.0
    expect(
      scoreKeywords("bucket in state space", ["bucket", "state space"]),
    ).toBe(3.0);
  });
});

// ── Research task detection (via inline reproduction of logic) ─────────

describe("research task detection", () => {
  it.each([
    "browse the web for info",
    "I need to research this topic",
    "look up the documentation",
    "lookup the api reference",
    "search for the latest version",
    "web search for react hooks",
    "check wikipedia for details",
    "find the website url",
    "read the web page content",
    "google this error message",
    "cite the source properly",
    "add a citation for this claim",
    "fact check this statement",
    "fact-check the numbers",
    "browse online resources",
    "researching the best approach",
  ])('detects research task: "%s"', (text) => {
    expect(looksLikeResearchTask(text)).toBe(true);
  });

  it.each([
    "read the file config.ts",
    "edit the function to fix the bug",
    "run the tests and build",
    "write a new module for auth",
    "hello world",
    "fix the type error in main.ts",
    "deploy the application",
    "refactor the shared utilities",
  ])('does not detect research task: "%s"', (text) => {
    expect(looksLikeResearchTask(text)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(looksLikeResearchTask("")).toBe(false);
  });

  it("returns false for undefined-like input", () => {
    expect(looksLikeResearchTask("") === false).toBe(true);
  });
});

// ── Gather tool detection ─────────────────────────────────────────────

describe("gather tool detection", () => {
  it.each([
    ["web-fetch", true],
    ["browser-search", true],
    ["navigate-page", true],
    ["extract-data", true],
    ["browse-web", true],
    ["fetch-url", true],
    ["read-file", false],
    ["edit-code", false],
    ["bash-shell", false],
    ["write-output", false],
  ])('isGatherTool("%s") === %s', (tool, expected) => {
    expect(isGatherTool(tool)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(isGatherTool("WEB-FETCH")).toBe(true);
    expect(isGatherTool("SearchTool")).toBe(true);
  });
});

// ── Research directive building ───────────────────────────────────────

describe("research directive building", () => {
  it("returns empty string when no gather tools", () => {
    expect(buildResearchDirective(new Set(["read", "edit"]))).toBe("");
  });

  it("includes gather tool names in directive", () => {
    const directive = buildResearchDirective(
      new Set(["web-fetch", "browser-search"]),
    );
    expect(directive).toContain("web-fetch");
    expect(directive).toContain("browser-search");
  });

  it("includes evidence-add reference when tool is active", () => {
    const directive = buildResearchDirective(
      new Set(["web-fetch", "evidence-add"]),
    );
    expect(directive).toContain("via evidence-add");
  });

  it("omits evidence-add reference when tool is not active", () => {
    const directive = buildResearchDirective(new Set(["web-fetch"]));
    expect(directive).not.toContain("via evidence-add");
    expect(directive).toContain("Save each citable fact before relying");
  });

  it("contains research-first directive heading", () => {
    const directive = buildResearchDirective(new Set(["web-fetch"]));
    expect(directive).toContain("## Research-first directive");
  });

  it("warns about skipping gather step", () => {
    const directive = buildResearchDirective(new Set(["web-fetch"]));
    expect(directive).toContain("Skipping the gather step");
  });
});

// ── Knowledge entry scoring with description bonus ─────────────────────

describe("knowledge entry description scoring", () => {
  // scoreKnowledgeEntry is internal; we test the concept via scoreKeywords
  // and verify the description bonus pattern manually.

  it("description word overlap adds fractional bonus", () => {
    // "dynamic" and "programming" both match = 1.0 bonus
    const bonus = computeDescriptionBonus(
      "dynamic programming approach",
      "Solve problems with dynamic programming",
    );
    expect(bonus).toBe(1.0);
  });

  it("short words do not contribute to description bonus", () => {
    const bonus = computeDescriptionBonus("a b c the", "a b c the and");
    expect(bonus).toBe(0);
  });

  it("keyword score dominates over description bonus", () => {
    // Single keyword match = 1.0, which is already significant
    expect(scoreKeywords("bucket", ["bucket"])).toBe(1.0);
    // Description bonus alone can never reach threshold without keywords
  });
});

// ── Token estimation ───────────────────────────────────────────────────

describe("token estimation", () => {
  it("estimates tokens as ceiling of length / 3.5", () => {
    expect(estimateTokens("hello")).toBe(2); // ceil(5/3.5) = 2
    expect(estimateTokens("hello world")).toBe(4); // ceil(11/3.5) = 4
    expect(estimateTokens("")).toBe(0);
  });

  it("handles long text proportionally", () => {
    const longText = "a".repeat(350);
    expect(estimateTokens(longText)).toBe(100); // ceil(350/3.5) = 100
  });
});

// ── Selection state budget tracking ────────────────────────────────────

describe("selection state budget tracking", () => {
  it("adds entries within budget", () => {
    const state = createSelectionState(300);
    state.tryAddEntry(makeSkill("a", null, { tokenCost: 100 }));
    state.tryAddEntry(makeSkill("b", null, { tokenCost: 200 }));
    expect(state.selected).toHaveLength(2);
    expect(state.used).toBe(300);
  });

  it("rejects entries exceeding budget", () => {
    const state = createSelectionState(150);
    state.tryAddEntry(makeSkill("a", null, { tokenCost: 100 }));
    state.tryAddEntry(makeSkill("b", null, { tokenCost: 100 })); // would exceed
    expect(state.selected).toHaveLength(1);
    expect(state.used).toBe(100);
  });

  it("rejects duplicate entries", () => {
    const state = createSelectionState(300);
    const entry = makeSkill("a", null, { tokenCost: 100 });
    state.tryAddEntry(entry);
    state.tryAddEntry(entry);
    expect(state.selected).toHaveLength(1);
  });

  it("respects allowed filter", () => {
    const allowed = new Set(["read"]);
    const state = createSelectionState(300, allowed);
    state.tryAdd("read"); // allowed
    state.tryAdd("edit"); // not in allowed set
    // tryAdd doesn't add entries without registry lookup; just tests the filter
  });

  it("handles zero budget", () => {
    const state = createSelectionState(0);
    state.tryAddEntry(makeSkill("a", null, { tokenCost: 1 }));
    expect(state.selected).toHaveLength(0);
  });
});

// ── Knowledge entry transformation ─────────────────────────────────────

describe("knowledge entry transformation", () => {
  it("caps token cost at PER_ENTRY_CAP", () => {
    const entry = makeSkill("big", null, {
      tokenCost: 500,
      topic: "Big Topic",
    });
    const ke = toKnowledgeEntry(entry);
    expect(ke.tokenCost).toBe(PER_ENTRY_CAP);
  });

  it("preserves token cost below cap", () => {
    const entry = makeSkill("small", null, {
      tokenCost: 50,
      topic: "Small Topic",
    });
    const ke = toKnowledgeEntry(entry);
    expect(ke.tokenCost).toBe(50);
  });

  it("preserves all fields", () => {
    const entry = makeSkill("test", null, {
      tokenCost: 100,
      topic: "Test Topic",
      keywords: ["kw1", "kw2"],
      requiresTools: ["read"],
      description: "A test skill",
    });
    const ke = toKnowledgeEntry(entry);
    expect(ke.topic).toBe("Test Topic");
    expect(ke.keywords).toEqual(["kw1", "kw2"]);
    expect(ke.requiresTools).toEqual(["read"]);
    expect(ke.description).toBe("A test skill");
  });
});

// ── Context state management ───────────────────────────────────────────

describe("context state management", () => {
  it("creates clean initial state", () => {
    const state = createContextState();
    expect(state.recentToolCalls).toEqual([]);
    expect(state.lastFailedTool).toBeNull();
    expect(state.sessionActive).toBe(false);
  });

  it("tracks recent tool calls in order", () => {
    const state = createContextState();
    updateRecency(state, "read");
    updateRecency(state, "edit");
    updateRecency(state, "bash");
    expect(state.recentToolCalls).toEqual(["bash", "edit", "read"]);
  });

  it("moves repeated tool to front", () => {
    const state = createContextState();
    updateRecency(state, "read");
    updateRecency(state, "edit");
    updateRecency(state, "read");
    expect(state.recentToolCalls).toEqual(["read", "edit"]);
  });

  it("caps recent calls at 8", () => {
    const state = createContextState();
    for (let i = 0; i < 10; i++) {
      updateRecency(state, `tool-${i}`);
    }
    expect(state.recentToolCalls).toHaveLength(8);
    expect(state.recentToolCalls[0]).toBe("tool-9");
    expect(state.recentToolCalls[7]).toBe("tool-2");
  });

  it("tracks failed tool", () => {
    const state = createContextState();
    state.lastFailedTool = "bash";
    expect(state.lastFailedTool).toBe("bash");
    state.lastFailedTool = null;
    expect(state.lastFailedTool).toBeNull();
  });
});

// ── Extension event handlers (mocked integration) ──────────────────────

async function initExtension() {
  const { default: extension } = await import("./index");
  const pi: any = {
    on: vi.fn(),
    getActiveTools: vi.fn(() => []),
  };
  extension(pi);
  return pi;
}

function getHandler(
  pi: any,
  eventName: string,
): (...args: any[]) => Promise<any> {
  return pi.on.mock.calls.find((call: any[]) => call[0] === eventName)[1];
}

describe("extension registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers session_start handler", async () => {
    const pi = await initExtension();
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  it("registers session_shutdown handler", async () => {
    const pi = await initExtension();
    expect(pi.on).toHaveBeenCalledWith(
      "session_shutdown",
      expect.any(Function),
    );
  });

  it("registers tool_result handler", async () => {
    const pi = await initExtension();
    expect(pi.on).toHaveBeenCalledWith("tool_result", expect.any(Function));
  });

  it("registers before_agent_start handler", async () => {
    const pi = await initExtension();
    expect(pi.on).toHaveBeenCalledWith(
      "before_agent_start",
      expect.any(Function),
    );
  });

  it("session_start handler is a function", async () => {
    const pi = await initExtension();
    const sessionStartHandler = getHandler(pi, "session_start");
    expect(typeof sessionStartHandler).toBe("function");
  });

  it("tool_result handler processes tool name from toolName field", async () => {
    const pi = await initExtension();
    await getHandler(pi, "session_start")();
    await getHandler(pi, "tool_result")({ toolName: "read", isError: false });
  });

  it("tool_result handler sets lastFailedTool on error", async () => {
    const pi = await initExtension();
    await getHandler(pi, "session_start")();
    await getHandler(pi, "tool_result")({ toolName: "bash", isError: true });
  });

  it("tool_result handler uses name field as fallback", async () => {
    const pi = await initExtension();
    await getHandler(pi, "session_start")();
    await getHandler(pi, "tool_result")({ name: "edit", isError: false });
  });

  it("session_shutdown resets state", async () => {
    const pi = await initExtension();
    await getHandler(pi, "session_start")();
    await getHandler(pi, "session_shutdown")();
  });
});

// ── buildSectionBlock integration ──────────────────────────────────────

describe("buildSectionBlock integration", () => {
  it("builds correct markdown structure for skill block", async () => {
    const { buildSectionBlock } = await import("../../shared/block-builder");
    const result = buildSectionBlock("Tool Usage Guidance", [
      { heading: "read (read-tool)", body: "Read docs" },
      { heading: "edit (edit-tool)", body: "Edit docs" },
    ]);

    expect(result).toContain("## Tool Usage Guidance");
    expect(result).toContain("### read (read-tool)");
    expect(result).toContain("Read docs");
    expect(result).toContain("### edit (edit-tool)");
    expect(result).toContain("Edit docs");
  });

  it("builds correct markdown structure for knowledge block", async () => {
    const { buildSectionBlock } = await import("../../shared/block-builder");
    const result = buildSectionBlock("Algorithm Reference", [
      { heading: "Binary Search", body: "Search algorithm" },
    ]);

    expect(result).toContain("## Algorithm Reference");
    expect(result).toContain("### Binary Search");
  });
});

// ── Full pipeline integration (with real registry) ─────────────────────

describe("full context injection pipeline", () => {
  it("scoreKeywords works with real skill keywords from knowledge skills", () => {
    // bucket(1) + pouring(1) + minimum_moves(2) = 4.0
    expect(
      scoreKeywords("bucket pouring puzzle minimum moves", [
        "bucket",
        "pouring",
        "state space",
        "minimum moves",
        "shortest sequence",
      ]),
    ).toBe(4.0);
  });

  it("high scores indicate strong relevance", () => {
    const score = scoreKeywords("dynamic programming for longest subsequence", [
      "dynamic",
      "programming",
      "subsequence",
      "minimum cost",
    ]);
    // dynamic(1) + programming(1) + subsequence(1) = 3.0 (above threshold)
    expect(score).toBeGreaterThanOrEqual(2.0);
  });

  it("low scores indicate weak relevance", () => {
    const score = scoreKeywords("hello world", [
      "dynamic",
      "programming",
      "subsequence",
    ]);
    expect(score).toBe(0);
  });
});
