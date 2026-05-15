---
name: task-decomposition
description: "Break complex tasks into GIVEN/UNKNOWN/PLAN before taking action. Use when tasks have multiple steps, require planning, or involve multi-step reasoning."
keywords:
  [
    "decompose",
    "plan",
    "steps",
    "breakdown",
    "multi-step",
    "reasoning",
    "strategy",
  ]
related: [research-protocol, cite-before-answer]
token_cost: 140
---

## Task Decomposition

Before taking ANY tool action, reply with a short decomposition:

GIVEN: <one line — what the prompt already states>
UNKNOWN: <one or two items — what you need to find out>
PLAN:

1. <first tool action, concrete>
2. <second tool action>
3. <final answer step>

## Rules

- Keep UNKNOWN to 1–2 items. If it grows past 2, split the task further in step 1
- Resolve one unknown fully before moving to the next — NEVER interleave
- After each tool call, check: did this resolve an UNKNOWN? If yes, strike it. If no, revise the PLAN
- ALWAYS write the decomposition before taking any tool action
- NEVER skip decomposition on multi-step tasks

## Example

```
GIVEN: User wants to know when Turing machines were invented
UNKNOWN: Year of Turing machine invention
PLAN:
  1. BrowserNavigate to Wikipedia article on Turing machines
  2. BrowserExtract to find the invention date
  3. evidence-add the fact and answer with citation
```

## Workflow

1. **Write decomposition**: Before any tool action, state GIVEN, UNKNOWN, and PLAN
2. **Limit unknowns**: Keep to 1-2 unknowns; split further if more arise
3. **Resolve sequentially**: Complete one unknown fully before moving to the next
4. **Check progress**: After each tool call, verify if an unknown was resolved
5. **Revise plan**: If a step doesn't resolve an unknown, adjust the plan accordingly
