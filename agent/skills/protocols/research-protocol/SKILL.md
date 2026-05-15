---
name: research-protocol
description: "Gather facts from the web using evidence-first approach with mandatory citations. Use when researching topics, answering factual questions, or any task requiring web-sourced evidence."
keywords:
  ["research", "web", "browse", "evidence", "fact", "search", "investigate"]
related: [cite-before-answer, task-decomposition]
token_cost: 180
---

## Research Protocol (evidence-first)

1. Decompose the question into one or two unknowns. Write them down in your first reply.
2. For each unknown, run BrowserNavigate → BrowserExtract → evidence-add (one fact per entry).
3. Do NOT state a fact that isn't backed by an evidence-add id.
4. Before answering, call evidence-list. Your answer must reference at least one id.
5. If evidence-list is empty, you are not ready to answer — go back to step 2.

## Rules

- NEVER state a fact that isn't backed by an evidence-add id
- ALWAYS call evidence-list before answering
- Your answer must reference at least one evidence id
- If evidence-list is empty, go back to gathering evidence
- After 3+ search refinements with no usable evidence, say "insufficient evidence" instead of guessing

## Stop conditions

- You have an evidence id for every claim in your answer → ANSWER
- You have tried 3+ search refinements with no usable evidence → say "insufficient evidence"

## Example workflow

```
BrowserNavigate(url="https://en.wikipedia.org/wiki/Turing_machine")
BrowserExtract(cursor="0")
evidence-add(source="...", note="Turing machine introduced in 1936", snippet="...")
evidence-list()
→ Answer with citations: e1
```

## Workflow

1. **Decompose**: Break the question into 1-2 unknowns
2. **Navigate**: Use BrowserNavigate to load relevant pages
3. **Extract**: Use BrowserExtract to read page content in chunks
4. **Save evidence**: Call evidence-add for each fact found (one fact per entry)
5. **Verify**: Call evidence-list before answering; answer must reference at least one ID
6. **Stop condition**: Answer when all claims have evidence; say "insufficient evidence" after 3+ failed searches
