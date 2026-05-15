---
name: evidence-add
description: "Save a short citable evidence snippet with source and note. Use when gathering facts for research tasks, saving claims for final answers, or building citation chains."
token_cost: 100
related: [research-protocol, cite-before-answer]
keywords:
  [
    "evidence",
    "cite",
    "source",
    "note",
    "snippet",
    "fact",
    "citation",
    "factcheck",
    "question",
    "answer",
  ]
---

## evidence-add Tool

Save a short citable snippet. Every fact you will put in your final answer must come from an evidence entry.

REQUIRED: source (URL or identifier), note (1-line summary), snippet (<=1KB of exact text)

RULES:

- Save the SMALLEST span that supports the claim. Don't dump a paragraph when one sentence is enough.
- One note = one claim. If a page has three useful facts, store three entries.
- Snippet must be verbatim from the source, not paraphrased.
- The returned id is what you cite in your final answer (e.g. `per e3a1f2`).

EXAMPLE:

```tool
{"name": "evidence-add", "input": {"source": "https://en.wikipedia.org/wiki/Turing_machine", "note": "Turing machine introduced in 1936", "snippet": "The Turing machine was invented in 1936 by Alan Turing."}}
```

## Workflow

1. **Extract smallest span**: Save only the text needed to support the specific claim
2. **One entry per fact**: If a source has multiple facts, create separate evidence entries
3. **Keep it verbatim**: Snippet must be exact text from the source, not paraphrased
4. **Cite by ID**: Use the returned ID in your final answer (e.g., `per e3a1f2`)
