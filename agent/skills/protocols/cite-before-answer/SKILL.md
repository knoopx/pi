---
name: cite-before-answer
description: "Verify all claims are backed by evidence before producing a final answer. Use when completing research tasks, writing cited answers, or ensuring factual accuracy."
keywords: ["cite", "citation", "evidence", "reference", "fact-check", "verify"]
related: [research-protocol, task-decomposition]
token_cost: 120
---

## Cite-before-answer checklist

Before typing your final answer, run this check internally:

1. Call evidence-list. Confirm it is non-empty.
2. For each claim in your planned answer, identify the evidence id(s) that support it.
3. If any claim has no id → either remove the claim, or go gather one more piece of evidence.
4. Prefix your final answer with `Citations: e1, e2, …` listing the ids you used.

## Rules

- A final answer with zero citations is invalid on research tasks
- NEVER guess — always back claims with evidence ids
- ALWAYS call evidence-list before answering
- If any claim has no evidence id, remove it or gather evidence first

## Example

```
Citations: e1, e2, e3

The Turing machine was invented in 1936 by Alan Turing [e1].
```

## Workflow

1. **List evidence**: Call evidence-list to see all saved evidence IDs
2. **Map claims**: Match each planned claim to a supporting evidence ID
3. **Fill gaps**: Remove uncited claims or gather more evidence
4. **Prefix answer**: Start with `Citations: e1, e2, …` listing all used IDs
