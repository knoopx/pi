---
description: Discover missing rules by analyzing session logs for recurring failures not covered by existing prompts, then encode them as clean principles
---

Analyze pi agent sessions across all projects to find failure patterns that have NO existing rule covering them, then create new rules to prevent those failures.

## Phase 1: Discover Patterns from Sessions

Query session logs from all projects (not just one) to find what goes wrong repeatedly:

```bash
# Session log location: ~/.pi/agent/sessions/<project-path>/
# Each project has its own directory with .jsonl files
```

Extract user messages that indicate corrections or frustrations. Use this single extraction command — do not run separate commands per pattern:

```bash
# Extract ALL non-empty user text from all sessions, sorted by length
for dir in ~/.pi/agent/sessions/*/; do
  shopt -s nullglob
  files=("$dir"*.jsonl)
  if [ ${#files[@]} -gt 0 ]; then
    for f in "${files[@]}"; do
      jq -r 'select(.type == "message") | select(.message.role == "user") | .message.content[]? | select(.type == "text") | .text' "$f" 2>/dev/null
    done
  fi
done | awk 'length > 10 && length < 500 {print}' | sort | uniq -c | sort -rn | head -60
```

Then filter those results with targeted `grep -iE` for patterns of interest. Do NOT run separate extraction loops per pattern — extract once, grep multiple times.

Look for:

- **Short correction messages** (under 60 chars): `typecheck`, `fix`, `continue`, `go`, `hangs` — these indicate the agent was off-track
- **Medium correction messages** (60-300 chars): Specific instructions like "DONT USE REGEX, USE AST", "NO GLOBAL STATE", "REMOVE LEGACY CODE"
- **Repeated error traces**: Same error appearing across multiple sessions indicates a systemic issue

Identify patterns that appear across multiple projects. A pattern appearing in 2+ different projects is a systemic issue worth encoding.

## Phase 2: Find What Is NOT Covered

**This is the critical step.** Before creating any new rule, scan ALL existing prompts to see if the pattern already has coverage:

```bash
# Search for patterns across all prompts — single pass
grep -rn 'global state\|regex.*pars\|lint.*disable\|type invent\|unused.*counter\|legacy.*remov\|constructor.*branch\|import.*resolv\|filesystem.*test\|REPL' agent/prompts/
```

For each finding from Phase 1, ask:

- Is there an existing rule that addresses this? → Improve that rule (rewrite the section, don't append)
- Is there NO existing rule? → Create a new rule in the appropriate prompt and section
- Does it fit multiple categories? → Place it in the most specific category

**The goal is to find what does NOT exist yet.** Improving an existing rule that already covers 80% of a pattern is less valuable than discovering a completely uncovered failure mode. Prioritize gaps over refinements.

**Priority ranking when multiple gaps are found:**

1. Patterns causing repeated user frustration (high correction frequency)
2. Patterns appearing across multiple projects (systemic issues)
3. Patterns that cause build/test failures (objective harm)
4. Patterns that only affect a single project (local issues) — lower priority

## Phase 3: Classify and Locate Gaps

Group uncovered findings into categories and map them to the prompt/section where they belong:

| Category          | Existing Coverage?                                                 | Action                      |
| ----------------- | ------------------------------------------------------------------ | --------------------------- |
| **Architecture**  | Global state, DI, constructor branching all covered                | Monitor for new patterns    |
| **Type Safety**   | Library type invention covered; import verification newly added    | Add uncovered type rules    |
| **Parsing**       | Regex-for-parsing covered                                          | Add uncovered parsing rules |
| **Tool Usage**    | sed prohibition, REPL blocking, directory context covered          | Add uncovered tool rules    |
| **Testing**       | Actual behavior testing, mocking, filesystem isolation newly added | Add uncovered testing rules |
| **Code Quality**  | Unused counters, legacy removal covered                            | Add uncovered quality rules |
| **Documentation** | No-invention rule covered                                          | Add uncovered docs rules    |

> **Update this table after each run.** When you add a new rule, update the corresponding row's "Existing Coverage?" column. This keeps future runs from re-discovering already-covered gaps.

## Phase 4: Write Rules for Gaps

### Rules for encoding patterns into prompts:

1. **Encode the principle, not the complaint.** The agent needs to know WHAT to do, not that the user was angry. Write clean, direct rules — never quote the user's frustrated messages.
2. **Place in the correct section.** A type invention rule goes in TypeScript section, a global state rule goes in Architecture section, a parsing rule goes in Tooling or TypeScript section.
3. **Use definitive language.** "Do not use regex for parsing structured data" — not "You should consider using proper parsers instead of regex sometimes."
4. **Be specific about the violation.** Name the anti-pattern clearly: "No regex hacks for parsing structured data (HTML, markdown, wikitext, JSON, etc.)" — not just "no bad parsing."
5. **One principle per bullet point.** Don't combine unrelated rules into a single bullet.

### What NOT to do:

- Do not append new bullets to the bottom of sections — rewrite the whole prompt
- Do not quote user feedback (profanity or otherwise) in prompts
- Do not create new prompt files for patterns that fit existing ones
- Do not make vague rules like "be more careful" — be specific about what behavior is wrong

## Phase 5: Verify Coverage

After writing, verify you addressed gaps by re-scanning:

```bash
# Check each uncovered pattern now has a rule
grep -rn '<pattern>' agent/prompts/
```

Read each modified prompt from top to bottom. Ask:

- Does the new principle flow naturally with existing rules?
- Is there any bullet that feels tacked on or out of place?
- Are there duplicate rules across different prompts that could be consolidated?
- Would a new agent understand this rule without seeing the original session that inspired it?

## Example: Discovering a Gap

**Session finding:** User said "NO BRANCHING ONLY this.project = new Project({" — appearing across multiple projects where constructors contained conditional logic and auto-discovery.

**Gap check:** No existing prompt has a rule about constructor simplicity. Global state rules exist but don't address constructor branching specifically.

**Rule created:** In `audit-codebase.md`, Architecture section:

> Constructors must not contain branching logic, conditionals, or side effects. A constructor only initializes state — no if checks, no file reads, no network calls, no auto-discovery.

## Output

Only modify existing prompt files in `agent/prompts/`. Do not create new files unless the pattern represents a genuinely new category of guidance that has no home in any existing prompt. After changes, run `bunx prettier --write` on each modified file.
